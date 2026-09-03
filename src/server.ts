import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { ROOT, env, siteConfig } from "./config.js";
import { ask, resetSession, sessionCount, sweepSessions } from "./chat/chat.js";
import { greeting, suggestions } from "./chat/persona.js";
import * as knowledge from "./kb/knowledge.js";
import { sanitizeUserMessage } from "./chat/safety.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

/* ---------------------------- CORS ---------------------------- */

const allowAll = env.allowedOrigins.includes("*");

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (allowAll) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && env.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-admin-token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

/* ------------------------- レート制限 ------------------------- */

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(req: Request): boolean {
  if (env.rateLimitPerMin <= 0) return false;
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > env.rateLimitPerMin;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(key);
  sweepSessions();
}, 60_000).unref();

/* ---------------------------- API ---------------------------- */

app.get("/api/config", (_req, res) => {
  const { character, clinic, policy } = siteConfig;
  const kb = knowledge.status();
  res.json({
    character: {
      name: character.name,
      title: character.title,
      tagline: character.tagline,
      theme: character.theme,
    },
    clinic: {
      name: clinic.name,
      reserveUrl: clinic.reserveUrl,
      contactUrl: clinic.contactUrl,
      lineUrl: clinic.lineUrl,
      tel: clinic.tel,
    },
    greeting: greeting(),
    suggestions: suggestions(),
    disclaimer: policy.disclaimer,
    knowledge: {
      updatedAt: kb.updatedAt,
      pageCount: kb.pageCount,
      ready: kb.ready,
    },
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    model: env.model,
    effort: env.effort,
    apiKey: env.hasApiKey,
    sessions: sessionCount(),
    knowledge: knowledge.status(),
    lastCrawl: knowledge.getLastCrawlResult(),
  });
});

/** SSE で1往復を返す */
app.post("/api/chat", async (req: Request, res: Response) => {
  const message = sanitizeUserMessage((req.body as { message?: unknown })?.message);
  const rawSession = (req.body as { sessionId?: unknown })?.sessionId;
  const sessionId =
    typeof rawSession === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(rawSession)
      ? rawSession
      : `anon-${req.ip ?? "0"}`;

  if (!message) {
    res.status(400).json({ error: "message が空です" });
    return;
  }
  if (rateLimited(req)) {
    res.status(429).json({
      error: "ご質問が続いています。1分ほどおいてからもう一度お試しください。",
    });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15_000);

  try {
    const result = await ask(sessionId, message, {
      onSources: (sources) => send("sources", { sources }),
      onDelta: (text) => send("delta", { text }),
    });
    send("done", { canned: result.canned, sources: result.sources });
  } catch (err) {
    send("error", { message: (err as Error).message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

app.post("/api/chat/reset", (req, res) => {
  const raw = (req.body as { sessionId?: unknown })?.sessionId;
  if (typeof raw === "string") resetSession(raw);
  res.json({ ok: true });
});

/** 管理用: 手動で再クロール */
app.post("/api/admin/refresh", async (req, res) => {
  if (!env.adminToken) {
    res.status(404).json({ error: "ADMIN_TOKEN が未設定のため無効です" });
    return;
  }
  if (req.headers["x-admin-token"] !== env.adminToken) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const result = await knowledge.refresh();
  res.json(result);
});

/* ----------------------- 静的ファイル ----------------------- */

// ウィジェット本体（ホームページ側からこの1本を読み込む）
app.use(
  "/widget",
  express.static(path.join(ROOT, "widget"), {
    setHeaders: (res) => res.setHeader("Cache-Control", "public, max-age=300"),
  }),
);
// 動作確認用のデモページ
app.use("/", express.static(path.join(ROOT, "public")));

/* -------------------------- 起動処理 -------------------------- */

function startScheduler(): void {
  const minutes = env.crawlIntervalMinutes;
  if (minutes <= 0) {
    console.log("[crawler] 自動再クロールは無効です (CRAWL_INTERVAL_MINUTES=0)");
    return;
  }
  setInterval(
    () => {
      void knowledge.refresh().then((r) => {
        console.log(
          `[crawler] 定期更新: ${r.pageCount}ページ / 変更${r.changedUrls.length}件`,
        );
      });
    },
    minutes * 60_000,
  ).unref();
  console.log(`[crawler] ${minutes}分ごとにホームページを再取得します`);
}

app.listen(env.port, () => {
  const status = knowledge.status();
  console.log(`\n${siteConfig.character.name} チャットサーバー起動: http://localhost:${env.port}`);
  console.log(`  デモページ  : http://localhost:${env.port}/demo.html`);
  console.log(`  埋め込みJS  : http://localhost:${env.port}/widget/manjaro-chat.js`);
  console.log(`  対象サイト  : ${env.siteUrl || "(SITE_URL 未設定)"}`);
  console.log(
    `  知識ベース  : ${status.pageCount}ページ / ${status.chunkCount}チャンク（更新 ${status.updatedAt}）`,
  );
  if (!env.hasApiKey) {
    console.warn("  ⚠ ANTHROPIC_API_KEY が未設定です。AI応答は停止し、案内文のみ返します。");
  }

  if (env.crawlOnBoot && env.siteUrl) {
    void knowledge.refresh().then((r) => {
      console.log(
        r.ok
          ? `[crawler] 初回取得: ${r.pageCount}ページ / ${r.chunkCount}チャンク (${r.durationMs}ms)`
          : `[crawler] 初回取得に失敗: ${r.errors.join(" / ")}`,
      );
    });
  }
  startScheduler();
});
