import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "../config.js";
import type { Chunk } from "./extract.js";

export const KB_PATH = path.join(DATA_DIR, "knowledge.json");

export interface PageRecord {
  url: string;
  title: string;
  description: string;
  publishedAt: string | null;
  hash: string;
  fetchedAt: string;
}

export interface KnowledgeBase {
  siteUrl: string;
  updatedAt: string;
  pages: PageRecord[];
  chunks: Chunk[];
  /** 直近のクロールで内容が変わった / 新しく増えたページ */
  changedUrls: string[];
}

export const emptyKnowledgeBase = (siteUrl: string): KnowledgeBase => ({
  siteUrl,
  updatedAt: new Date(0).toISOString(),
  pages: [],
  chunks: [],
  changedUrls: [],
});

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function loadKnowledgeBase(siteUrl: string): KnowledgeBase {
  if (!fs.existsSync(KB_PATH)) return emptyKnowledgeBase(siteUrl);
  try {
    const kb = JSON.parse(fs.readFileSync(KB_PATH, "utf8")) as KnowledgeBase;
    if (!Array.isArray(kb.chunks) || !Array.isArray(kb.pages)) {
      return emptyKnowledgeBase(siteUrl);
    }
    kb.changedUrls ??= [];
    return kb;
  } catch {
    return emptyKnowledgeBase(siteUrl);
  }
}

export function saveKnowledgeBase(kb: KnowledgeBase): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${KB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(kb), "utf8");
  fs.renameSync(tmp, KB_PATH);
}
