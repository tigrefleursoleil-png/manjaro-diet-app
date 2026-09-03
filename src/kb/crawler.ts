/**
 * ホームページを巡回して知識ベースを作り直す。
 * sitemap.xml があればそれを優先し、無ければ同一ドメイン内をリンク伝いに辿る。
 */
import { env } from "../config.js";
import { chunkPage, extractPage, type Chunk } from "./extract.js";
import {
  hashText,
  loadKnowledgeBase,
  saveKnowledgeBase,
  type KnowledgeBase,
  type PageRecord,
} from "./store.js";

const USER_AGENT =
  "ManjaroDietBot/0.1 (+clinic FAQ assistant; contact via clinic website)";

const SKIP_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|mjs|zip|docx?|xlsx?|pptx?|mp4|mp3|woff2?|ttf|eot)$/i;

export interface CrawlResult {
  ok: boolean;
  siteUrl: string;
  pageCount: number;
  chunkCount: number;
  changedUrls: string[];
  errors: string[];
  durationMs: number;
}

async function fetchText(
  url: string,
  timeoutMs = 15000,
): Promise<{ status: number; body: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body =
      res.ok && /text\/html|xml|text\/plain/i.test(contentType)
        ? await res.text()
        : "";
    return { status: res.status, body, contentType };
  } finally {
    clearTimeout(timer);
  }
}

/** robots.txt の Disallow を最小限だけ解釈する */
async function loadRobots(origin: string): Promise<string[]> {
  try {
    const { status, body } = await fetchText(`${origin}/robots.txt`, 8000);
    if (status !== 200 || !body) return [];
    const disallow: string[] = [];
    let applies = false;
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.split("#")[0]?.trim() ?? "";
      const ua = /^user-agent:\s*(.+)$/i.exec(trimmed);
      if (ua?.[1]) {
        applies = ua[1].trim() === "*" || /manjarodietbot/i.test(ua[1]);
        continue;
      }
      const dis = /^disallow:\s*(\S*)$/i.exec(trimmed);
      if (applies && dis && dis[1]) disallow.push(dis[1]);
    }
    return disallow;
  } catch {
    return [];
  }
}

const isAllowed = (pathname: string, disallow: string[]): boolean =>
  !disallow.some((rule) => pathname.startsWith(rule));

async function loadSitemapUrls(origin: string, limit: number): Promise<string[]> {
  const found = new Set<string>();
  const queue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const seenSitemaps = new Set<string>();

  while (queue.length > 0 && found.size < limit) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    try {
      const { status, body } = await fetchText(sitemapUrl, 12000);
      if (status !== 200 || !body) continue;
      const isIndex = /<sitemapindex/i.test(body);
      for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const loc = m[1];
        if (!loc) continue;
        if (isIndex) {
          if (seenSitemaps.size + queue.length < 25) queue.push(loc);
        } else if (loc.startsWith(origin)) {
          found.add(normalizeUrl(loc));
        }
        if (found.size >= limit) break;
      }
    } catch {
      // sitemap が無いサイトは通常フロー（リンク巡回）に任せる
    }
  }
  return [...found];
}

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  // トラッキングパラメータは同一ページ扱いにする
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|gclid|fbclid|yclid|_ga)/i.test(key)) u.searchParams.delete(key);
  }
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return u.toString();
}

export async function crawlSite(options?: {
  siteUrl?: string;
  maxPages?: number;
  maxDepth?: number;
}): Promise<CrawlResult> {
  const started = Date.now();
  const siteUrl = options?.siteUrl ?? env.siteUrl;
  const maxPages = options?.maxPages ?? env.crawlMaxPages;
  const maxDepth = options?.maxDepth ?? env.crawlMaxDepth;
  const errors: string[] = [];

  if (!siteUrl) {
    return {
      ok: false,
      siteUrl: "",
      pageCount: 0,
      chunkCount: 0,
      changedUrls: [],
      errors: ["SITE_URL が設定されていません（.env を確認してください）"],
      durationMs: Date.now() - started,
    };
  }

  const start = new URL(siteUrl);
  const origin = start.origin;
  const disallow = await loadRobots(origin);

  const queue: { url: string; depth: number }[] = [
    { url: normalizeUrl(start.toString()), depth: 0 },
  ];
  for (const url of await loadSitemapUrls(origin, maxPages)) {
    queue.push({ url, depth: 1 });
  }

  const visited = new Set<string>();
  const seenHashes = new Set<string>();
  const pages: PageRecord[] = [];
  const chunks: Chunk[] = [];
  const previous = loadKnowledgeBase(siteUrl);
  const previousHashes = new Map(previous.pages.map((p) => [p.url, p.hash]));
  const changedUrls: string[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const item = queue.shift();
    if (!item) break;
    const { url, depth } = item;
    if (visited.has(url)) continue;
    visited.add(url);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.origin !== origin) continue;
    if (SKIP_EXTENSIONS.test(parsed.pathname)) continue;
    if (!isAllowed(parsed.pathname, disallow)) continue;

    try {
      const { status, body, contentType } = await fetchText(url);
      if (status !== 200 || !body || !/text\/html/i.test(contentType)) continue;

      const page = extractPage(body);
      if (page.text.length < 40) continue;

      const hash = hashText(page.text);
      // 同一内容の別URL（/ と /index.html など）は最初の1つだけ採用する
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);
      const before = previousHashes.get(url);
      if (before !== hash) changedUrls.push(url);

      pages.push({
        url,
        title: page.title || parsed.pathname,
        description: page.description,
        publishedAt: page.publishedAt,
        hash,
        fetchedAt: new Date().toISOString(),
      });
      chunks.push(...chunkPage(url, page));

      if (depth < maxDepth) {
        for (const href of page.links) {
          try {
            const next = normalizeUrl(new URL(href, url).toString());
            if (!visited.has(next) && next.startsWith(origin)) {
              queue.push({ url: next, depth: depth + 1 });
            }
          } catch {
            // 壊れたリンクは無視
          }
        }
      }
    } catch (err) {
      errors.push(`${url}: ${(err as Error).message}`);
    }
  }

  if (pages.length === 0) {
    errors.push("ページを1件も取得できませんでした（URL / ネットワークを確認してください）");
    return {
      ok: false,
      siteUrl,
      pageCount: 0,
      chunkCount: 0,
      changedUrls: [],
      errors,
      durationMs: Date.now() - started,
    };
  }

  const kb: KnowledgeBase = {
    siteUrl,
    updatedAt: new Date().toISOString(),
    pages,
    chunks,
    changedUrls,
  };
  saveKnowledgeBase(kb);

  return {
    ok: true,
    siteUrl,
    pageCount: pages.length,
    chunkCount: chunks.length,
    changedUrls,
    errors,
    durationMs: Date.now() - started,
  };
}
