/** 検索の当たり具合を確認する（開発用） */
import { getIndex, getKnowledgeBase } from "../kb/knowledge.js";
import { search } from "../kb/search.js";

const queries = process.argv.slice(2);
const kb = getKnowledgeBase();
console.log(`pages=${kb.pages.length} chunks=${kb.chunks.length}\n`);
for (const q of queries) {
  console.log(`--- Q: ${q}`);
  for (const hit of search(getIndex(), q, 3)) {
    console.log(
      `  ${hit.score.toFixed(2)} [${hit.chunk.heading || hit.chunk.pageTitle}] ${hit.chunk.text.slice(0, 70).replace(/\n/g, " ")}`,
    );
  }
}
