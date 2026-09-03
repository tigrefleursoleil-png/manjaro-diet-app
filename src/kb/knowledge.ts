/** 知識ベースと検索インデックスの保持・更新（サーバー全体で1つ） */
import { env } from "../config.js";
import { crawlSite, type CrawlResult } from "./crawler.js";
import { buildIndex, type SearchIndex } from "./search.js";
import { loadKnowledgeBase, type KnowledgeBase } from "./store.js";

let kb: KnowledgeBase = loadKnowledgeBase(env.siteUrl);
let index: SearchIndex = buildIndex(kb);
let refreshing: Promise<CrawlResult> | null = null;
let lastResult: CrawlResult | null = null;

export const getKnowledgeBase = (): KnowledgeBase => kb;
export const getIndex = (): SearchIndex => index;
export const getLastCrawlResult = (): CrawlResult | null => lastResult;

export function reload(): void {
  kb = loadKnowledgeBase(env.siteUrl);
  index = buildIndex(kb);
}

/** クロールし直してインデックスを差し替える。同時実行は1本にまとめる */
export function refresh(): Promise<CrawlResult> {
  if (refreshing) return refreshing;
  refreshing = crawlSite()
    .then((result) => {
      lastResult = result;
      if (result.ok) reload();
      return result;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export const isRefreshing = (): boolean => refreshing !== null;

/** システムプロンプトに入れるサイト構成の一覧（安定させてキャッシュを効かせる） */
export function siteOutline(maxPages = 60): string {
  if (kb.pages.length === 0) return "（まだホームページを取り込んでいません）";
  return kb.pages
    .slice()
    .sort((a, b) => a.url.localeCompare(b.url))
    .slice(0, maxPages)
    .map((p) => `- ${p.title}（${p.url}）${p.description ? `: ${p.description.slice(0, 80)}` : ""}`)
    .join("\n");
}

/** 「〇〇について教えて」形式の質問候補を、取り込んだページから作る */
export function suggestedQuestions(max = 4): string[] {
  const chunkCount = new Map<string, number>();
  for (const chunk of kb.chunks) {
    chunkCount.set(chunk.url, (chunkCount.get(chunk.url) ?? 0) + 1);
  }
  const root = kb.siteUrl.replace(/\/+$/, "");
  // 質問にしても中身が伝わらないページは候補から外す
  const skip = /(よくある質問|q&a|faq|お知らせ|新着|ブログ|コラム|プライバシー|個人情報|サイトマップ|採用|求人)/i;

  return kb.pages
    .filter((page) => page.url.replace(/\/+$/, "") !== root && !skip.test(page.title))
    .sort((a, b) => (chunkCount.get(b.url) ?? 0) - (chunkCount.get(a.url) ?? 0))
    .map((page) => topicOf(page.title))
    .filter((topic, i, all) => topic.length >= 2 && topic.length <= 14 && all.indexOf(topic) === i)
    .slice(0, max)
    .map((topic) => `${topic}について教えて`);
}

/** 「費用について | 〇〇クリニック」→「費用」 */
function topicOf(title: string): string {
  const head = title.split(/\s*[|｜/／>＞-]\s*/)[0] ?? title;
  return head
    .replace(/(について|のご案内|のご紹介|の案内|のごあんない|一覧|ページ)$/u, "")
    .trim();
}

export interface KnowledgeStatus {
  siteUrl: string;
  updatedAt: string;
  pageCount: number;
  chunkCount: number;
  changedUrls: string[];
  refreshing: boolean;
  ready: boolean;
}

export const status = (): KnowledgeStatus => ({
  siteUrl: kb.siteUrl,
  updatedAt: kb.updatedAt,
  pageCount: kb.pages.length,
  chunkCount: kb.chunks.length,
  changedUrls: kb.changedUrls.slice(0, 20),
  refreshing: isRefreshing(),
  ready: kb.chunks.length > 0,
});
