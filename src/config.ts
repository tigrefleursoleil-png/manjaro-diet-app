import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const CONFIG_DIR = path.join(ROOT, "config");

/** .env を最小実装で読み込む（依存を増やさないため） */
function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv(path.join(ROOT, ".env"));

export interface SiteConfig {
  clinic: {
    name: string;
    shortName: string;
    hours: string;
    tel: string;
    reserveUrl: string;
    contactUrl: string;
    lineUrl: string;
  };
  character: {
    name: string;
    title: string;
    tagline: string;
    personality: string[];
    speechStyle: string[];
    greeting: string;
    fallbackReply: string;
    theme: {
      primary: string;
      primaryDark: string;
      accent: string;
      bubble: string;
      avatarUrl: string;
    };
    suggestions: string[];
  };
  policy: { disclaimer: string; urgentNotice: string };
}

export const siteConfig: SiteConfig = JSON.parse(
  fs.readFileSync(path.join(CONFIG_DIR, "site.json"), "utf8"),
) as SiteConfig;

/** 診療科ごとの言い換え辞書（任意）。無ければ既定の一般語だけを使う。 */
export const extraSynonyms: Record<string, string[]> = (() => {
  const file = path.join(CONFIG_DIR, "synonyms.json");
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) out[key] = value.map(String);
    }
    return out;
  } catch {
    console.warn("[config] synonyms.json を読み込めませんでした（無視して続行します）");
    return {};
  }
})();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function effortLevel(raw: string | undefined): Effort {
  const allowed: Effort[] = ["low", "medium", "high", "xhigh", "max"];
  const found = allowed.find((level) => level === raw);
  return found ?? "low";
}

export const env = {
  port: num("PORT", 8787),
  allowedOrigins: (process.env["ALLOWED_ORIGINS"] ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  siteUrl: process.env["SITE_URL"] ?? "",
  crawlMaxPages: num("CRAWL_MAX_PAGES", 120),
  crawlMaxDepth: num("CRAWL_MAX_DEPTH", 3),
  crawlIntervalMinutes: num("CRAWL_INTERVAL_MINUTES", 360),
  crawlOnBoot: bool("CRAWL_ON_BOOT", true),
  model: process.env["BOT_MODEL"] ?? "claude-opus-5",
  effort: effortLevel(process.env["BOT_EFFORT"]),
  adminToken: process.env["ADMIN_TOKEN"] ?? "",
  rateLimitPerMin: num("RATE_LIMIT_PER_MIN", 12),
  logConversations: bool("LOG_CONVERSATIONS", true),
  hasApiKey: Boolean(
    process.env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_AUTH_TOKEN"],
  ),
};

fs.mkdirSync(DATA_DIR, { recursive: true });
