# 本番移行の手順

開発用の動作確認から、実際のホームページで患者さんに使ってもらうまでの手順です。
所要時間の目安は **半日〜1日**（サーバーの用意を含む）。

---

## 0. 先に用意するもの

| | 内容 | 備考 |
|---|---|---|
| ① | **Anthropic の APIキー** | https://console.anthropic.com でアカウント作成 → クレジットカード登録 → API keys から発行。`sk-ant-...` |
| ② | **常時起動できるサーバー** | VPS（さくら・ConoHa・Xserver VPS 等、月1,000円前後〜）か、Render / Railway / Cloud Run など。**静的ホスティング（Netlify・GitHub Pages）では動きません** |
| ③ | **サブドメイン1つ** | 例 `chat.example.clinic`。ホームページのDNSにAレコードを1本追加 |
| ④ | **ホームページに1行貼れる人** | 制作会社に依頼する場合は、この文書の「6. 埋め込み」だけ渡せば伝わります |
| ⑤ | **キャラクター画像**（任意） | `public/avatar.png` に置くだけ。無ければ同梱イラストを使用 |

> **サーバーが必要な理由**: ホームページを定期巡回して知識ベースを保持し、APIキーを秘匿したまま
> Claude と通信し、回答をストリーミングで返すため、常駐プロセスが要ります。
> APIキーをホームページ側のJavaScriptに置くことは絶対にしないでください（誰でも抜き取れます）。

---

## 1. サーバーに配置する

### A. Docker で動かす（推奨）

```bash
git clone <このリポジトリ> /opt/clinic-chat
cd /opt/clinic-chat
cp .env.example .env
vi .env                    # → 「3. 本番の .env」を参照
docker compose up -d --build
docker compose logs -f     # 起動ログとクロール結果を確認
```

`data/` に知識ベースと会話ログが残り、コンテナを作り直しても消えません。
`config/` と `public/` はマウントしているので、設定変更・画像差し替えは
`docker compose restart chat` だけで反映できます。

### B. Node を直接動かす（systemd）

```bash
sudo useradd -r -s /bin/false clinic
sudo git clone <このリポジトリ> /opt/clinic-chat
cd /opt/clinic-chat
sudo -u clinic npm ci && sudo -u clinic npm run build
sudo cp .env.example .env && sudo vi .env
sudo chown -R clinic:clinic /opt/clinic-chat
sudo cp deploy/clinic-chat.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now clinic-chat
sudo journalctl -u clinic-chat -f
```

### C. PaaS（Render / Railway / Cloud Run など）

- ビルド `npm ci && npm run build` / 起動 `npm start`
- **永続ディスクを `/app/data` に割り当てる**（無い場合は再起動のたびに再クロールが走ります。動作はしますが起動が遅くなります）
- **レスポンスのバッファリングを切る**設定があれば切ってください（回答が一気に届く症状の原因）
- Cloud Run など「リクエストが無いとゼロにスケールする」環境では定期クロールが動きません。
  `CRAWL_INTERVAL_MINUTES=0` にして、外部のスケジューラから `/api/admin/refresh` を叩く運用にしてください

---

## 2. HTTPS を通す（A・Bの場合）

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/clinic-chat
sudo vi /etc/nginx/sites-available/clinic-chat     # ドメイン名を書き換え
sudo ln -s /etc/nginx/sites-available/clinic-chat /etc/nginx/sites-enabled/
sudo certbot --nginx -d chat.example.clinic
sudo nginx -t && sudo systemctl reload nginx
```

**`proxy_buffering off;` を必ず入れてください。** これが無いと、回答が1文字ずつ流れず、
数秒待ってから一気に表示される見た目になります。

---

## 3. 本番の .env

```bash
ANTHROPIC_API_KEY=sk-ant-...                    # ①で発行したキー
SITE_URL=https://example.clinic                 # 読み込ませるホームページ
ALLOWED_ORIGINS=https://example.clinic,https://www.example.clinic
                                                # ★ * にしない。www有無の両方を書く
PORT=8787
TRUST_PROXY=1                                   # nginx など前段がある場合。無いと同一IP扱いになる
ADMIN_TOKEN=<推測されない長い文字列>              # 手動更新APIの鍵
CRAWL_INTERVAL_MINUTES=360                      # 6時間ごとに再取得
CRAWL_MAX_PAGES=120                             # ページ数が多いサイトは増やす
RATE_LIMIT_PER_MIN=12
LOG_CONVERSATIONS=true                          # 相談内容を残したくなければ false
BOT_MODEL=claude-opus-5
BOT_EFFORT=low
```

`config/site.json` も本番の値に更新してください（医院名・診療時間・電話・予約URL・お問い合わせURL）。
ここに書いた連絡先が、回答の中で患者さんに案内されます。

---

## 4. 取り込み結果を確認する

```bash
docker compose exec chat node -e "console.log(require('/app/data/knowledge.json').pages.length)"
# または
curl -s https://chat.example.clinic/api/status | jq .knowledge
```

- **ページ数が想定より極端に少ない場合**は、ホームページがJavaScriptで描画するタイプ（Wix・STUDIO・SPAなど）の可能性があります。
  その場合はクローラがテキストを取れません。対処は「9. うまくいかないとき」を参照
- 取り込めているか中身で確かめる:
  ```bash
  npm run search -- "駐車場" "予約" "費用"      # APIキー不要
  npm run ask -- "初診の流れを教えてください"     # 実際の回答を確認
  ```

---

## 5. 公開前チェックリスト

- [ ] 想定質問を20問ほど `npm run ask` で流し、**回答内容を医師が確認**した
- [ ] ホームページに書いていないこと（他院の料金、個別の診断など）を聞いても、
      作り話をせず「記載がない」と答えることを確認した
- [ ] 危険な症状（「胸が痛い」「息が苦しい」など）で救急案内の定型文が出ることを確認した
- [ ] `ALLOWED_ORIGINS` が本番ドメインのみになっている（`*` になっていない）
- [ ] `ADMIN_TOKEN` を設定した／`/api/admin/refresh` が無認証で叩けないことを確認した
- [ ] HTTPSでアクセスでき、`https://chat.example.clinic/healthz` が `{"ok":true}` を返す
- [ ] 免責文（画面下部）の文言を医院として承認した
- [ ] 会話ログを残すか（`LOG_CONVERSATIONS`）を決め、残す場合はプライバシーポリシーに記載した

---

## 6. ホームページに埋め込む（制作会社に渡すのはここだけ）

`</body>` の直前に次の1行を追加してください。

```html
<script src="https://chat.example.clinic/widget/manjaro-chat.js"
        data-api="https://chat.example.clinic" defer></script>
```

- 右下にキャラクターのボタンが出ます。既存ページのCSSには影響しません（Shadow DOM）
- 左下に出したい場合は `data-position="left"`
- ページ内の任意のボタンから開くこともできます: `<button onclick="ManjaroChat.open()">AIに質問</button>`
- WordPress の場合はテーマの `footer.php`、または「Insert Headers and Footers」系プラグインのフッター欄へ

---

## 7. 公開後の運用

| やること | 方法 |
|---|---|
| ホームページ更新をすぐ反映 | `curl -X POST https://chat.example.clinic/api/admin/refresh -H "x-admin-token: $ADMIN_TOKEN"`（何もしなければ6時間ごとに自動更新） |
| 患者さんが何を聞いたか見る | `data/conversations.jsonl`。よく聞かれてホームページに無い項目は、**ホームページ側に追記**すれば回答できるようになります |
| 費用の確認 | Anthropic コンソールの Usage。まずは**上限（Spend limit）を月1万円などに設定**しておくと安心です |
| 費用を下げたい | `BOT_EFFORT=low` のまま `BOT_MODEL=claude-sonnet-5` に変更する選択肢もあります（回答品質は下がります） |
| キャラクター画像の差し替え | `public/avatar.png` を置き換えて再起動 |
| 文言・性格の調整 | `config/site.json` を編集して再起動 |

---

## 8. 止め方・戻し方

```bash
docker compose down            # 停止（データは data/ に残る）
docker compose up -d --build   # 再開
```

ホームページ側は `<script>` の1行を消せば、それだけでボタンが消えます。
サーバーを止めてもホームページ自体には影響しません（ボタンは出るが応答しない状態になるので、
長期間止める場合は1行を外してください）。

---

## 9. うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| 回答が流れず、数秒後に一気に出る | リバースプロキシのバッファリング。nginx なら `proxy_buffering off;` |
| ボタンは出るが「通信がうまくいきませんでした」 | `ALLOWED_ORIGINS` にホームページのオリジンが入っていない（www有無に注意）／`data-api` のURLが違う |
| 取り込みページ数が 0〜2 件 | ホームページがJavaScript描画型。`sitemap.xml` があれば拾えることがあります。それでも取れない場合は、静的HTMLを出力するページの追加か、クローラにヘッドレスブラウザを組み込む改修が必要です（対応可能なのでご相談ください） |
| 「記載がない」ばかり返ってくる | 知識ベースが空か、該当ページが未取得。`/api/status` のページ数と `npm run search` で確認 |
| 429 が返る | `RATE_LIMIT_PER_MIN` を上げる。院内から一斉にテストする場合は特に |
| 起動時に「ANTHROPIC_API_KEY が未設定」 | `.env` の読み込み先を確認（Docker は `env_file: .env`、systemd は `EnvironmentFile`） |
