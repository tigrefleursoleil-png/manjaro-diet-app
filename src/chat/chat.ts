/**
 * 会話1往復の処理。
 * 「ホームページから取り込んだ資料を検索 → Claude で会話形式に整えて返す」を担当する。
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { DATA_DIR, env, siteConfig } from "../config.js";
import { getIndex, getKnowledgeBase } from "../kb/knowledge.js";
import { buildContext, search } from "../kb/search.js";
import { buildSystemPrompt } from "./persona.js";
import { checkUserMessage } from "./safety.js";

/** APIキー未設定でもサーバーを起動できるよう、クライアントは遅延生成する */
let clientRef: Anthropic | null = null;
function getClient(): Anthropic {
  clientRef ??= new Anthropic();
  return clientRef;
}

export interface Source {
  url: string;
  title: string;
}

export interface AskHandlers {
  onSources?: (sources: Source[]) => void;
  onDelta?: (text: string) => void;
}

export interface AskResult {
  text: string;
  sources: Source[];
  /** モデルを呼ばずに定型文で返したか（緊急時など） */
  canned: boolean;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

/* ------------------------------------------------------------------ *
 * セッション（会話履歴）: プロセス内メモリ。個人情報は保存しない。
 * ------------------------------------------------------------------ */

interface Session {
  messages: Anthropic.MessageParam[];
  updatedAt: number;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TURNS = 12;
const sessions = new Map<string, Session>();

function getSession(id: string): Session {
  const existing = sessions.get(id);
  if (existing) return existing;
  const created: Session = { messages: [], updatedAt: Date.now() };
  sessions.set(id, created);
  return created;
}

export function sweepSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.updatedAt < cutoff) sessions.delete(id);
  }
}

export const resetSession = (id: string): void => void sessions.delete(id);
export const sessionCount = (): number => sessions.size;

/* ------------------------------------------------------------------ */

const CONVERSATION_LOG = path.join(DATA_DIR, "conversations.jsonl");

function logConversation(entry: Record<string, unknown>): void {
  if (!env.logConversations) return;
  try {
    fs.appendFileSync(
      CONVERSATION_LOG,
      `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
      "utf8",
    );
  } catch {
    // ログ失敗で会話を止めない
  }
}

function contactFallback(): string {
  const { clinic, character } = siteConfig;
  const lines = [
    character.fallbackReply,
    clinic.contactUrl ? `・お問い合わせ：${clinic.contactUrl}` : "",
    clinic.tel ? `・お電話：${clinic.tel}（${clinic.hours}）` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** 検索結果と質問を1つのユーザーターンにまとめる */
function buildUserTurn(question: string, context: string, hitCount: number): string {
  if (hitCount === 0) {
    return `<資料>
（この質問に関連する記載はホームページ内に見つかりませんでした）
</資料>

患者さんからの質問:
${question}

資料が無いため、事実を作らずに「答えられないこと」を伝え、連絡先を案内してください。`;
  }
  return `<資料>
${context}
</資料>

患者さんからの質問:
${question}

上の<資料>だけを根拠に、${siteConfig.character.name}として会話形式で答えてください。資料に無いことは答えないでください。`;
}

export async function ask(
  sessionId: string,
  question: string,
  handlers: AskHandlers = {},
): Promise<AskResult> {
  const session = getSession(sessionId);
  session.updatedAt = Date.now();

  // 1) 安全チェック（緊急性の高い訴えはモデルを呼ばずに即答）
  const verdict = checkUserMessage(question);
  if (verdict.kind !== "ok") {
    handlers.onSources?.([]);
    handlers.onDelta?.(verdict.reply);
    session.messages.push(
      { role: "user", content: question },
      { role: "assistant", content: verdict.reply },
    );
    logConversation({ sessionId, question, kind: verdict.kind });
    return { text: verdict.reply, sources: [], canned: true };
  }

  // 2) ホームページから取り込んだ最新テキストを検索
  const kb = getKnowledgeBase();
  const hits = kb.chunks.length > 0 ? search(getIndex(), question, 8) : [];
  const context = buildContext(hits);
  handlers.onSources?.(context.sources);

  // 3) API キーが無い / 知識ベースが空でも、案内だけは返す
  if (!env.hasApiKey) {
    const text = `${contactFallback()}\n（管理者向け: ANTHROPIC_API_KEY が設定されていないため、AI応答は停止しています）`;
    handlers.onDelta?.(text);
    return { text, sources: context.sources, canned: true };
  }

  const history = session.messages.slice(-MAX_TURNS * 2);

  try {
    const stream = getClient().beta.messages.stream({
      model: env.model,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: env.effort },
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      messages: [
        ...history,
        {
          role: "user",
          content: buildUserTurn(question, context.text, context.hitCount),
        },
      ],
    });

    let answer = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        answer += event.delta.text;
        handlers.onDelta?.(event.delta.text);
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      const text = contactFallback();
      handlers.onDelta?.(text);
      logConversation({ sessionId, question, kind: "refusal" });
      return { text, sources: context.sources, canned: true };
    }

    if (!answer.trim()) {
      const text = contactFallback();
      handlers.onDelta?.(text);
      return { text, sources: context.sources, canned: true };
    }

    session.messages.push(
      { role: "user", content: question },
      { role: "assistant", content: answer },
    );
    if (session.messages.length > MAX_TURNS * 2) {
      session.messages = session.messages.slice(-MAX_TURNS * 2);
    }

    logConversation({
      sessionId,
      question,
      answer,
      sources: context.sources.map((s) => s.url),
      hitCount: context.hitCount,
      usage: final.usage,
    });

    return {
      text: answer,
      sources: context.sources,
      canned: false,
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      },
    };
  } catch (err) {
    const detail = describeError(err);
    logConversation({ sessionId, question, kind: "error", detail });
    const text = `申し訳ありません、いまうまくお答えできませんでした。少し時間をおいてもう一度お試しください。\n${contactFallback()}`;
    handlers.onDelta?.(text);
    return { text, sources: [], canned: true };
  }
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "rate_limit";
  if (err instanceof Anthropic.AuthenticationError) return "auth";
  if (err instanceof Anthropic.NotFoundError) return "not_found(model?)";
  if (err instanceof Anthropic.APIConnectionError) return "connection";
  if (err instanceof Anthropic.APIError) return `api_error_${err.status ?? "unknown"}`;
  return `unknown: ${(err as Error)?.message ?? String(err)}`;
}
