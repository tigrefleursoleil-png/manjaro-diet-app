/**
 * 日本語のホームページを対象にした BM25 検索。
 * 形態素解析器を入れずに動かすため、CJKは2文字グラム、英数字は単語で索引する。
 */
import type { Chunk } from "./extract.js";
import { extraSynonyms } from "../config.js";
import type { KnowledgeBase } from "./store.js";

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
const LATIN_WORD = /[a-z0-9]+/g;

/**
 * 患者さんが使いがちな言い換えを索引語に足す。
 * 診療科ごとの用語（例: 舌下免疫療法＝減感作）は config/synonyms.json に書き足せます。
 */
const DEFAULT_SYNONYMS: Record<string, string[]> = {
  料金: ["値段", "価格", "費用", "いくら", "金額", "自費"],
  保険: ["保険適用", "自費", "自由診療", "3割"],
  予約: ["申し込み", "申込", "受診", "来院", "初診", "当日"],
  キャンセル: ["変更", "取り消し", "遅れ"],
  診療時間: ["営業時間", "何時", "受付時間", "休診", "土曜", "日曜"],
  アクセス: ["場所", "行き方", "最寄り", "駅", "駐車場", "バス"],
  検査: ["調べ", "採血", "血液検査", "結果", "レントゲン", "エコー"],
  薬: ["処方", "内服", "飲み薬", "塗り薬", "点眼", "点鼻", "吸入"],
  副作用: ["リスク", "デメリット", "安全性", "副反応", "眠くなる"],
  子ども: ["小児", "こども", "赤ちゃん", "何歳", "小学生"],
  オンライン: ["リモート", "遠隔", "オンライン診療"],
  紹介状: ["セカンドオピニオン", "連携", "他院"],
};

const SYNONYMS: Record<string, string[]> = { ...DEFAULT_SYNONYMS, ...extraSynonyms };

export interface IndexedChunk extends Chunk {
  id: number;
  tokens: Map<string, number>;
  length: number;
}

export interface SearchIndex {
  builtFrom: string;
  chunks: IndexedChunk[];
  df: Map<string, number>;
  avgLength: number;
}

export function tokenize(input: string): string[] {
  const text = input.toLowerCase();
  const tokens: string[] = [];

  for (const m of text.matchAll(LATIN_WORD)) {
    if (m[0].length >= 2) tokens.push(m[0]);
  }

  let run = "";
  const flush = (): void => {
    if (run.length === 1) {
      tokens.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2));
      if (run.length >= 3) tokens.push(run);
    }
    run = "";
  };
  for (const ch of text) {
    if (CJK.test(ch)) run += ch;
    else if (run) flush();
  }
  if (run) flush();

  return tokens;
}

export function expandQuery(query: string): string {
  let expanded = query;
  for (const [key, alts] of Object.entries(SYNONYMS)) {
    if (query.includes(key)) expanded += ` ${alts.join(" ")}`;
    else if (alts.some((a) => query.includes(a))) expanded += ` ${key}`;
  }
  return expanded;
}

export function buildIndex(kb: KnowledgeBase): SearchIndex {
  const chunks: IndexedChunk[] = [];
  const df = new Map<string, number>();
  let totalLength = 0;

  kb.chunks.forEach((chunk, id) => {
    // 見出しとページタイトルは検索の手がかりとして重み付けのため2回入れる
    const surface = `${chunk.pageTitle} ${chunk.heading} ${chunk.heading} ${chunk.text}`;
    const tokenList = tokenize(surface);
    const tokens = new Map<string, number>();
    for (const t of tokenList) tokens.set(t, (tokens.get(t) ?? 0) + 1);
    for (const t of tokens.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    totalLength += tokenList.length;
    chunks.push({ ...chunk, id, tokens, length: tokenList.length });
  });

  return {
    builtFrom: kb.updatedAt,
    chunks,
    df,
    avgLength: chunks.length > 0 ? totalLength / chunks.length : 1,
  };
}

const K1 = 1.2;
const B = 0.75;

export interface SearchHit {
  chunk: IndexedChunk;
  score: number;
}

export function search(
  index: SearchIndex,
  query: string,
  topK = 8,
): SearchHit[] {
  if (index.chunks.length === 0) return [];
  const queryTokens = tokenize(expandQuery(query));
  if (queryTokens.length === 0) return [];

  const qtf = new Map<string, number>();
  for (const t of queryTokens) qtf.set(t, (qtf.get(t) ?? 0) + 1);

  const N = index.chunks.length;
  const hits: SearchHit[] = [];

  for (const chunk of index.chunks) {
    let score = 0;
    for (const [term, qCount] of qtf) {
      const tf = chunk.tokens.get(term);
      if (!tf) continue;
      const df = index.df.get(term) ?? 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const norm = tf * (K1 + 1) /
        (tf + K1 * (1 - B + B * (chunk.length / index.avgLength)));
      // 長い語（3文字以上のカタカナ語や英単語）はノイズが少ないので加点
      const weight = term.length >= 3 ? 1.4 : 1;
      score += idf * norm * Math.min(qCount, 3) * weight;
    }
    if (score > 0) hits.push({ chunk, score });
  }

  hits.sort((a, b) => b.score - a.score);

  // 上位から大きく離れたスコアはノイズなので落とす
  const top = hits[0]?.score ?? 0;
  const cutoff = top * 0.15;

  // 同一ページに偏らないよう、1ページあたり最大3チャンクに制限
  const perPage = new Map<string, number>();
  const diversified: SearchHit[] = [];
  for (const hit of hits) {
    if (hit.score < cutoff) break;
    const used = perPage.get(hit.chunk.url) ?? 0;
    if (used >= 3) continue;
    perPage.set(hit.chunk.url, used + 1);
    diversified.push(hit);
    if (diversified.length >= topK) break;
  }
  return diversified;
}

export interface RetrievedContext {
  text: string;
  sources: { url: string; title: string }[];
  hitCount: number;
}

const CONTEXT_CHAR_BUDGET = 7000;

/** 検索結果をモデルに渡す形へ整形する */
export function buildContext(hits: SearchHit[]): RetrievedContext {
  const sources: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  const blocks: string[] = [];
  let used = 0;

  for (const [i, hit] of hits.entries()) {
    const { chunk } = hit;
    const block = [
      `<資料 ${i + 1}>`,
      `ページ: ${chunk.pageTitle || "(無題)"}`,
      `URL: ${chunk.url}`,
      chunk.heading ? `見出し: ${chunk.heading}` : "",
      chunk.text,
      `</資料 ${i + 1}>`,
    ]
      .filter(Boolean)
      .join("\n");

    if (used + block.length > CONTEXT_CHAR_BUDGET) break;
    used += block.length;
    blocks.push(block);

    if (!seen.has(chunk.url)) {
      seen.add(chunk.url);
      sources.push({ url: chunk.url, title: chunk.pageTitle || chunk.url });
    }
  }

  return { text: blocks.join("\n\n"), sources, hitCount: blocks.length };
}
