/**
 * HTML から本文テキストと見出し構造を取り出す。
 * 外部パーサに依存せず、ナビ・フッター・スクリプト等のノイズを落とす。
 */

const DROP_BLOCKS =
  /<(script|style|noscript|template|svg|iframe|nav|header|footer|form|aside|select)\b[^>]*>[\s\S]*?<\/\1>/gi;
const SELF_CLOSING_NOISE = /<(script|style|link|meta|img|input|br|hr)\b[^>]*\/?>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&yen;": "¥",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => {
      if (ENTITIES[m]) return ENTITIES[m];
      const dec = /^&#(\d+);$/.exec(m);
      if (dec?.[1]) return String.fromCodePoint(Number(dec[1]));
      const hex = /^&#x([0-9a-fA-F]+);$/.exec(m);
      if (hex?.[1]) return String.fromCodePoint(parseInt(hex[1], 16));
      return m;
    })
    .replace(/\u00a0/g, " ");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export interface ExtractedPage {
  title: string;
  description: string;
  /** 見出しごとに区切ったセクション */
  sections: { heading: string; text: string }[];
  /** 同一ページ内で見つかったリンク（絶対URL化は呼び出し側） */
  links: string[];
  /** 本文全体（ハッシュ用） */
  text: string;
  /** <html lang> や記事の更新日など、見つかればメタ情報として */
  publishedAt: string | null;
}

/** 本文らしい領域だけに絞り込む（main / article / #content 等） */
function pickMainRegion(html: string): string {
  const candidates = [
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<div\b[^>]*(?:id|class)="[^"]*(?:content|main|entry|post|article)[^"]*"[^>]*>([\s\S]*)<\/div>/i,
  ];
  for (const re of candidates) {
    const m = re.exec(html);
    if (m?.[1] && m[1].length > 400) return m[1];
  }
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return body?.[1] ?? html;
}

export function extractPage(html: string): ExtractedPage {
  const title = decodeEntities(
    stripTags(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""),
  ).trim();

  const description = decodeEntities(
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(
      html,
    )?.[1] ?? "",
  ).trim();

  const publishedAt =
    /<meta\b[^>]*property=["']article:(?:published|modified)_time["'][^>]*content=["']([^"']*)["']/i.exec(
      html,
    )?.[1] ??
    /<time\b[^>]*datetime=["']([^"']*)["']/i.exec(html)?.[1] ??
    null;

  const links: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["']/gi)) {
    if (m[1]) links.push(decodeEntities(m[1]));
  }

  let region = pickMainRegion(html)
    .replace(COMMENTS, " ")
    .replace(DROP_BLOCKS, " ")
    .replace(SELF_CLOSING_NOISE, " ");

  // テーブルとリストは区切り文字を入れてから平文化（料金表などが潰れないように）
  region = region
    .replace(/<\/(td|th)>/gi, " ｜ ")
    .replace(/<\/(tr|li|p|div|dd|dt|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // 見出しで分割
  const parts = region.split(/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/i);
  const sections: { heading: string; text: string }[] = [];

  const pushSection = (heading: string, raw: string): void => {
    const text = normalizeText(decodeEntities(stripTags(raw)));
    if (text.length < 20) return;
    sections.push({ heading: normalizeText(heading), text });
  };

  if (parts.length === 1) {
    pushSection("", parts[0] ?? "");
  } else {
    pushSection("", parts[0] ?? "");
    for (let i = 1; i < parts.length; i += 3) {
      const heading = decodeEntities(stripTags(parts[i + 1] ?? ""));
      pushSection(heading, parts[i + 2] ?? "");
    }
  }

  const text = sections
    .map((s) => (s.heading ? `${s.heading}\n${s.text}` : s.text))
    .join("\n\n");

  return { title, description, sections, links, text, publishedAt };
}

export function normalizeText(input: string): string {
  return input
    .replace(/[\t　]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?:\s*｜\s*)+/g, " ｜ ")
    .trim();
}

export interface Chunk {
  url: string;
  pageTitle: string;
  heading: string;
  text: string;
}

const CHUNK_TARGET = 700;
const CHUNK_MAX = 1000;

/** セクションを検索しやすい長さに刻む */
export function chunkPage(
  url: string,
  page: ExtractedPage,
  maxChunksPerPage = 40,
): Chunk[] {
  const chunks: Chunk[] = [];
  const head = page.description ? `${page.description}\n` : "";

  for (const section of page.sections) {
    const body = `${chunks.length === 0 ? head : ""}${section.text}`;
    for (const piece of splitByLength(body)) {
      chunks.push({
        url,
        pageTitle: page.title,
        heading: section.heading,
        text: piece,
      });
      if (chunks.length >= maxChunksPerPage) return chunks;
    }
  }
  return chunks;
}

function splitByLength(text: string): string[] {
  if (text.length <= CHUNK_MAX) return [text];
  const out: string[] = [];
  // 文の区切り（。！？改行）を優先して分ける
  const sentences = text.split(/(?<=[。！？\n])/);
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length > CHUNK_TARGET && buf.length > 0) {
      out.push(buf.trim());
      // 直前の1文を重ねて文脈を保つ
      const tail = buf.slice(-120);
      buf = `${tail}${s}`;
    } else {
      buf += s;
    }
    if (buf.length > CHUNK_MAX) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((c) => c.length >= 20);
}
