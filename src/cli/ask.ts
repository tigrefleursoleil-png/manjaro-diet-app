/** 動作確認: npm run ask -- "料金を教えて" */
import { ask } from "../chat/chat.js";
import * as knowledge from "../kb/knowledge.js";

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('使い方: npm run ask -- "マンジャロの副作用は？"');
  process.exit(1);
}

const status = knowledge.status();
console.log(
  `知識ベース: ${status.pageCount}ページ / ${status.chunkCount}チャンク（更新 ${status.updatedAt}）\n`,
);
console.log(`Q: ${question}\nA: `);

const result = await ask("cli-session", question, {
  onDelta: (text) => process.stdout.write(text),
});

console.log("\n\n--- 出典 ---");
for (const s of result.sources) console.log(`- ${s.title}: ${s.url}`);
if (result.usage) {
  console.log(
    `--- usage: in=${result.usage.inputTokens} out=${result.usage.outputTokens} cacheRead=${result.usage.cacheReadTokens}`,
  );
}
