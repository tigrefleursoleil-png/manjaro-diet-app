/** 手動クロール: npm run crawl [-- https://example.clinic] */
import { env } from "../config.js";
import { crawlSite } from "../kb/crawler.js";

const siteUrl = process.argv[2] ?? env.siteUrl;
console.log(`クロール開始: ${siteUrl || "(SITE_URL 未設定)"}`);

const result = await crawlSite({ siteUrl });
console.log(JSON.stringify({ ...result, changedUrls: result.changedUrls.slice(0, 20) }, null, 2));
process.exit(result.ok ? 0 : 1);
