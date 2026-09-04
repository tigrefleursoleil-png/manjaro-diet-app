# 公開手順（本番移行）

サーバーの知識がなくても進められる順に書いています。
**Render** を使う方法（1〜4章）が一番かんたんです。Linuxサーバーを自分で用意する方法は5章以降。

**全体の流れ**（作業時間の目安 合計2〜3時間、待ち時間を除く）

| | やること | 時間 | 費用 |
|---|---|---|---|
| 1 | AnthropicのAPIキーを取る | 15分 | 前払いクレジット 最低 $5 |
| 2 | Render にデプロイする | 30分 | $7/月（約1,100円）+ ディスク $0.25/月 |
| 3 | 動作を確認する | 30分 | — |
| 4 | ホームページに1行貼る | 5分 | — |

ランニングコストは **サーバー約1,100円/月 + API利用料（1質問あたり数円）**。
1日20質問なら API 側は月1,000〜2,000円程度が目安です。

---

## 1. AnthropicのAPIキーを取る

1. https://console.anthropic.com を開き、Googleアカウントかメールアドレスで **Sign up**
   （メールの場合はパスワード不要。届いたリンクを開くとログインできます）
2. 組織名などを聞かれたら医院名を入力
3. 左メニュー **Plans & Billing** → **Add funds**（または Purchase Credits）
   → 海外決済ができるクレジットカードを登録し、**まず $5〜$20 を購入**
   （Anthropic は前払い式です。残高が切れると回答が止まります）
4. 左メニュー **API keys** → **Create Key** → 名前は `clinic-chat` など
   → 表示された **`sk-ant-...` をコピーして安全な場所に保管**
   （この画面を閉じると二度と表示されません。紛失したら作り直します）
5. 使いすぎ防止に **Spend limit（使用上限）** を設定しておくと安心です（例: 月 $30）

> このキーは**絶対にホームページのHTMLやJavaScriptに書かないでください**。誰でも抜き取れます。
> このアプリはキーをサーバー側だけで使う作りになっています。

---

## 2. Render にデプロイする

Renderは、GitHubのリポジトリを繋ぐと自動でビルド・公開してくれるサービスです。
SSHもLinux操作もSSL証明書の設定も不要で、**HTTPSが自動で付きます**。

### 2-1. サインアップ

https://render.com にGitHubアカウントでサインアップします。

### 2-2. Web Service を作る

1. ダッシュボードで **New +** → **Web Service**
2. GitHubを接続し、このリポジトリ（`manjaro-diet-app`）を選ぶ
3. 設定画面で以下を入力します

| 項目 | 値 |
|---|---|
| Name | `clinic-chat`（URLの一部になります） |
| Region | **Singapore**（日本から一番近い） |
| Branch | `claude/patient-ai-chatbot-1a7t8c`（またはmainに取り込み済みなら `main`） |
| Language / Runtime | **Node** |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Instance Type | **Starter（$7/月）** |

> **Free プランは選ばないでください。** 15分アクセスが無いとサーバーが眠り、
> 次の患者さんの質問で数十秒待たされます。定期クロールも動きません。

### 2-3. 環境変数を入れる

同じ画面の **Environment Variables** で以下を追加します（`PORT` はRenderが自動で入れるので不要）。

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | 1章でコピーした `sk-ant-...` |
| `SITE_URL` | `https://（医院のホームページURL）` |
| `ALLOWED_ORIGINS` | `https://example.clinic,https://www.example.clinic`（**www有り・無しの両方**を書く） |
| `TRUST_PROXY` | `1` |
| `ADMIN_TOKEN` | 推測されない長い文字列（パスワード生成でOK） |
| `NODE_ENV` | `production` |

### 2-4. ディスクとヘルスチェック（Advanced）

- **Health Check Path**: `/healthz`
- **Add Disk**: Name `data` / Mount Path `/opt/render/project/src/data` / Size `1 GB`

ディスクは、取り込んだホームページの情報と相談ログを保存する場所です。
（付けなくても動きます。その場合は再起動のたびに取り込み直すので、起動が少し遅くなり、相談ログは残りません）

### 2-5. 作成

**Create Web Service** を押すとビルドが始まります。5分ほどで
`https://clinic-chat-xxxx.onrender.com` のようなURLが発行されます。

Logsタブに `[crawler] 初回取得: ○ページ` と出れば、ホームページの取り込みも成功しています。

---

## 3. 動作を確認する

ブラウザで次の3つを開きます。

1. `https://（RenderのURL）/healthz` → `{"ok":true,"ready":true}` と表示される
2. `https://（RenderのURL）/api/status` → `pageCount` が取り込めたページ数。
   **ここが 0〜2 件しかない場合は要注意**（→ 7章「うまくいかないとき」）
3. `https://（RenderのURL）/demo.html` → 右下のキャラクターから実際に質問できる

デモページで、次のような質問を **20問ほど** 試してください。

- 診療時間・休診日／予約は必要か／駐車場／初診の費用／子どもは何歳から
- ホームページに書いていないこと（例:「他院より安いですか？」）→ 作り話をせず「記載がない」と答えるか
- 危険な症状（例:「胸が痛くて冷や汗が出ます」）→ すぐ救急案内の定型文が出るか

**この回答内容を医師が確認してから**、次の4章に進んでください。

---

## 4. ホームページに1行貼る

ホームページの `</body>` の直前に、次の1行を追加します。

```html
<script src="https://clinic-chat-xxxx.onrender.com/widget/manjaro-chat.js"
        data-api="https://clinic-chat-xxxx.onrender.com" defer></script>
```

- WordPress なら「外観 → テーマファイルエディター → footer.php」か、
  「Insert Headers and Footers」系プラグインのフッター欄
- 制作会社に依頼する場合は、**この1行を渡すだけ**で伝わります
- 左下に出したいときは `data-position="left"` を足します

貼ったらホームページを開き、右下にキャラクターのボタンが出ることを確認してください。
外したくなったら、この1行を消すだけで元に戻ります。

### 独自ドメインにしたい場合（任意）

Render の **Settings → Custom Domains** で `chat.example.clinic` を追加し、
表示されたCNAMEをホームページのDNSに登録します。証明書は自動で発行されます。
その後、上の1行のURLを独自ドメインに書き換えてください。

---

## 5. 公開前チェックリスト

- [ ] 想定質問20問の回答を **医師が確認**した
- [ ] ホームページに無いことを聞いても作り話をしないことを確認した
- [ ] 危険な症状で救急案内が出ることを確認した
- [ ] `ALLOWED_ORIGINS` が本番ドメインだけになっている（`*` になっていない）
- [ ] `ADMIN_TOKEN` を設定した
- [ ] 免責文（画面下部）の文言を医院として承認した
- [ ] 相談ログを残すか（`LOG_CONVERSATIONS`）を決め、残すならプライバシーポリシーに記載した
- [ ] Anthropic の Spend limit を設定した

---

## 6. 公開後の運用

| やること | 方法 |
|---|---|
| ホームページ更新をすぐ反映 | 何もしなければ6時間ごとに自動更新。すぐ反映したいときは `curl -X POST https://（URL）/api/admin/refresh -H "x-admin-token: （ADMIN_TOKEN）"` |
| 患者さんが何を聞いたか見る | `data/conversations.jsonl`（Renderの Shell タブから確認）。**よく聞かれるのにホームページに無い項目は、ホームページ側に書き足す**のが一番効きます |
| 費用の確認 | Anthropic コンソールの Usage。残高が減ってきたら Add funds |
| 文言・キャラクターの調整 | `config/site.json` を編集してGitHubにpush → Renderが自動で再デプロイ |
| キャラクター画像 | `public/avatar.png` を置き換えてpush |

---

## 7. うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| 取り込みページ数が 0〜2件 | ホームページがJavaScriptで描画するタイプ（Wix・STUDIO・一部のSPA）の可能性。クローラが文章を取れません。`sitemap.xml` があれば拾えることもあります。取れない場合はヘッドレスブラウザを組み込む改修が必要です（対応可能なのでご相談ください） |
| ボタンは出るが「通信がうまくいきませんでした」 | `ALLOWED_ORIGINS` にホームページのオリジンが入っていない（**www有無**に注意）／`data-api` のURLが違う |
| 回答が流れず数秒後に一気に出る | 前段にnginx等がある場合のバッファリング。Renderでは通常起きません（自前サーバーの場合は9章参照） |
| 「記載がない」ばかり返る | 知識ベースが空。`/api/status` のページ数を確認 |
| 「ANTHROPIC_API_KEY が未設定」と返る | Renderの環境変数に入っていない／保存後に再デプロイされていない |
| 急に回答しなくなった | Anthropicの残高切れ。コンソールで Add funds |

---

## 8. 自前のサーバーに置く場合（VPS + Docker）

Renderを使わず、さくら／ConoHa／Xserver VPS などに置く場合はこちらです。

```bash
git clone <このリポジトリ> /opt/clinic-chat
cd /opt/clinic-chat
cp .env.example .env
vi .env                    # → 下の「本番の .env」を参照
docker compose up -d --build
docker compose logs -f
```

`data/` に知識ベースと相談ログが残ります。`config/` と `public/` はマウントしているので、
設定変更や画像差し替えは `docker compose restart chat` だけで反映できます。

### 本番の .env

```bash
ANTHROPIC_API_KEY=sk-ant-...
SITE_URL=https://example.clinic
ALLOWED_ORIGINS=https://example.clinic,https://www.example.clinic
PORT=8787
TRUST_PROXY=1
ADMIN_TOKEN=<推測されない長い文字列>
CRAWL_INTERVAL_MINUTES=360
CRAWL_MAX_PAGES=120
RATE_LIMIT_PER_MIN=12
LOG_CONVERSATIONS=true
BOT_MODEL=claude-opus-5
BOT_EFFORT=low
```

### Docker を使わない場合（systemd）

```bash
sudo useradd -r -s /bin/false clinic
sudo git clone <このリポジトリ> /opt/clinic-chat
cd /opt/clinic-chat
sudo -u clinic npm ci && sudo -u clinic npm run build
sudo cp .env.example .env && sudo vi .env
sudo chown -R clinic:clinic /opt/clinic-chat
sudo cp deploy/clinic-chat.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now clinic-chat
```

---

## 9. 自前サーバーのHTTPS（nginx）

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/clinic-chat
sudo vi /etc/nginx/sites-available/clinic-chat     # ドメイン名を書き換え
sudo ln -s /etc/nginx/sites-available/clinic-chat /etc/nginx/sites-enabled/
sudo certbot --nginx -d chat.example.clinic
sudo nginx -t && sudo systemctl reload nginx
```

**`proxy_buffering off;` を必ず入れてください。** これが無いと回答が1文字ずつ流れず、
数秒待ってから一気に表示される見た目になります。

---

## 10. その他のPaaS（Railway / Cloud Run など）

- ビルド `npm ci && npm run build` / 起動 `npm start` / ヘルスチェック `/healthz`
- **永続ディスクを `data/` に割り当てる**（無い場合は再起動のたびに再クロール。動作はします）
- **レスポンスのバッファリングを切る**設定があれば切る
- Cloud Run のように「アクセスが無いとゼロにスケールする」環境では定期クロールが動きません。
  `CRAWL_INTERVAL_MINUTES=0` にして、外部スケジューラから `/api/admin/refresh` を叩いてください
