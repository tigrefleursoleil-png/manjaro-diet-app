/*!
 * クリニック チャットウィジェット（キャラクター「あおい」）
 * ホームページに1行貼るだけで、右下にAIキャラクターのボタンを表示します。
 *
 *   <script src="https://chat.example.clinic/widget/manjaro-chat.js"
 *           data-api="https://chat.example.clinic" defer></script>
 *
 * 任意の要素からも開けます:  <button onclick="ManjaroChat.open()">AIに質問</button>
 */
(function () {
  "use strict";

  if (window.__manjaroChatLoaded) return;
  window.__manjaroChatLoaded = true;

  var script = document.currentScript;
  var scriptSrc = script ? script.src : "";
  var apiBase = (script && script.getAttribute("data-api")) || "";
  if (!apiBase && scriptSrc) {
    try {
      apiBase = new URL(scriptSrc).origin;
    } catch (e) {
      apiBase = "";
    }
  }
  apiBase = apiBase.replace(/\/+$/, "");

  var position = (script && script.getAttribute("data-position")) || "right";
  var autoTeaser = (script && script.getAttribute("data-teaser")) !== "off";

  /* ------------------------------------------------------------ *
   * 状態
   * ------------------------------------------------------------ */

  var config = {
    character: {
      name: "AIアシスタント",
      title: "",
      tagline: "",
      theme: {
        primary: "#12b48a",
        primaryDark: "#0d8f6d",
        accent: "#ffd166",
        bubble: "#eefaf6",
        avatarUrl: "",
      },
    },
    clinic: {},
    greeting: "こんにちは。ご質問をどうぞ。",
    suggestions: [],
    disclaimer: "",
    knowledge: { updatedAt: null, pageCount: 0, ready: false },
  };

  var state = {
    open: false,
    busy: false,
    booted: false,
    transcript: [],
  };

  var SESSION_KEY = "manjaro-chat-session";
  var TRANSCRIPT_KEY = "manjaro-chat-transcript";

  function sessionId() {
    var id = "";
    try {
      id = window.localStorage.getItem(SESSION_KEY) || "";
    } catch (e) {
      /* localStorage が使えない環境（プライベートモード等） */
    }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = "s" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      try {
        window.localStorage.setItem(SESSION_KEY, id);
      } catch (e) {
        /* 保存できなくても会話は続けられる */
      }
    }
    return id;
  }

  function saveTranscript() {
    try {
      window.sessionStorage.setItem(
        TRANSCRIPT_KEY,
        JSON.stringify(state.transcript.slice(-40)),
      );
    } catch (e) {
      /* 保存できなくても動作に影響なし */
    }
  }

  function loadTranscript() {
    try {
      var raw = window.sessionStorage.getItem(TRANSCRIPT_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /* ------------------------------------------------------------ *
   * DOM 構築（Shadow DOM でホームページ側のCSSと干渉させない）
   * ------------------------------------------------------------ */

  var host = document.createElement("div");
  host.id = "manjaro-chat-root";
  host.style.cssText = "position:fixed;z-index:2147483000;inset:auto 0 0 0;pointer-events:none;";
  var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var el = {};

  /** 同じSVGを何度も差し込むので、defs の id は毎回変える */
  var avatarSeq = 0;

  /**
   * キャラクターの既定イラスト: やわらかい印象の女性医師（白衣＋聴診器）。
   * config の theme.avatarUrl に画像を入れれば、そちらが優先されます。
   */
  function avatarSvg(size) {
    if (config.character.theme.avatarUrl) {
      return (
        '<img class="mj-avatar-img" src="' +
        escapeAttr(config.character.theme.avatarUrl) +
        '" alt="" width="' + size + '" height="' + size + '">'
      );
    }
    var n = ++avatarSeq;
    var clip = "mj-clip-" + n;
    var bg = "mj-bg-" + n;
    var hair = "#3a2723";
    var hairLight = "#6d4a41";
    var skin = "#f9ddc9";
    return (
      '<svg class="mj-avatar-svg" viewBox="0 0 64 64" width="' + size + '" height="' + size +
      '" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<clipPath id="' + clip + '"><circle cx="32" cy="32" r="32"/></clipPath>' +
      '<linearGradient id="' + bg + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fbfdff"/><stop offset="1" stop-color="#e7f1fa"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<g clip-path="url(#' + clip + ')">' +
      '<rect width="64" height="64" fill="url(#' + bg + ')"/>' +
      // 白衣の肩・襟もと
      '<path d="M3 64c2.5-11.5 13-16.5 29-16.5S58.5 52.5 61 64z" fill="#ffffff"/>' +
      '<path d="M25 48.6 32 60l7-11.4-3.4-1.8L32 53l-3.6-6.2z" fill="#dbe9f6"/>' +
      // 首すじ
      '<path d="M27.6 40.6h8.8v8.2a4.4 4.4 0 0 1-8.8 0z" fill="#f0c5a9"/>' +
      '<path d="M27.6 41.6c2.2 2.2 6.6 2.2 8.8 0v2.2c-2.2 2-6.6 2-8.8 0z" fill="#e0ae93" opacity=".55"/>' +
      // 後ろ髪（毛先を内巻きに）
      '<path d="M14 33.4C14 18.6 21.6 10 32 10s18 8.6 18 23.4c0 8.4-.8 14.4-2.2 20.6-1.6.4-3 .2-4.4-.6 2.4-9.4 2.6-17 2-22.6H18.6c-.6 5.6-.4 13.2 2 22.6-1.4.8-2.8 1-4.4.6C14.8 47.8 14 41.8 14 33.4z" fill="' + hair + '"/>' +
      // 顔（あご先を細く）
      '<path d="M20.2 27.6c0-8.2 5.2-13.8 11.8-13.8s11.8 5.6 11.8 13.8c0 5.6-.7 9.6-2.5 12.7-2 3.4-5.5 5.7-9.3 5.7s-7.3-2.3-9.3-5.7c-1.8-3.1-2.5-7.1-2.5-12.7z" fill="' + skin + '"/>' +
      // 前髪（斜めに流す）
      '<path d="M19.4 28.6C19.4 17 24.6 11 32 11s12.6 6 12.6 17.6c-.9-5.6-2.6-9-5.2-10.6-3.4 4.2-9.4 6.6-14.6 6.9-1.6 1.2-2.6 3-3.4 5.7z" fill="' + hair + '"/>' +
      '<path d="M25.4 19.8c2.2-2.2 4.8-3.4 7.6-3.6" stroke="' + hairLight + '" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".32"/>' +
      // 眉（細くアーチ）
      '<path d="M24.7 24.6c1.8-1.4 4-1.3 5.5-.1" stroke="#7d5a50" stroke-width=".85" stroke-linecap="round" fill="none"/>' +
      '<path d="M39.3 24.6c-1.8-1.4-4-1.3-5.5-.1" stroke="#7d5a50" stroke-width=".85" stroke-linecap="round" fill="none"/>' +
      // 二重まぶた
      '<path d="M24.6 28.2c1.6-1.4 4-1.4 5.4-.2" stroke="#e3b89e" stroke-width=".8" stroke-linecap="round" fill="none"/>' +
      '<path d="M39.4 28.2c-1.6-1.4-4-1.4-5.4-.2" stroke="#e3b89e" stroke-width=".8" stroke-linecap="round" fill="none"/>' +
      // 瞳
      '<ellipse cx="27.1" cy="31.4" rx="2.15" ry="2.8" fill="#4a3129"/>' +
      '<ellipse cx="36.9" cy="31.4" rx="2.15" ry="2.8" fill="#4a3129"/>' +
      '<circle cx="27.9" cy="30.4" r=".85" fill="#ffffff"/>' +
      '<circle cx="37.7" cy="30.4" r=".85" fill="#ffffff"/>' +
      '<circle cx="26.5" cy="32.5" r=".5" fill="#ffffff" opacity=".6"/>' +
      '<circle cx="36.3" cy="32.5" r=".5" fill="#ffffff" opacity=".6"/>' +
      // まつげ（目尻を少し上げる）
      '<path d="M24.9 29.2c1.5-1.4 3.6-1.4 5 0" stroke="#3a2723" stroke-width="1.05" ' +
      'stroke-linecap="round" fill="none"/>' +
      '<path d="M39.1 29.2c-1.5-1.4-3.6-1.4-5 0" stroke="#3a2723" stroke-width="1.05" ' +
      'stroke-linecap="round" fill="none"/>' +
      '<path d="M24.4 29.4l-.9-.8" stroke="#3a2723" stroke-width=".9" stroke-linecap="round"/>' +
      '<path d="M39.6 29.4l.9-.8" stroke="#3a2723" stroke-width=".9" stroke-linecap="round"/>' +
      // 頬・鼻・口もと
      '<ellipse cx="23.4" cy="35.6" rx="2.2" ry="1.4" fill="#f6a3b0" opacity=".5"/>' +
      '<ellipse cx="40.6" cy="35.6" rx="2.2" ry="1.4" fill="#f6a3b0" opacity=".5"/>' +
      '<path d="M31.4 34.6c.7.8 1.3.8 1.8.2" stroke="#e0ae93" stroke-width=".9" stroke-linecap="round" fill="none"/>' +
      '<path d="M29.4 37.5c1.6-.9 3.6-.9 5.2 0-1 2.4-4.2 2.4-5.2 0z" fill="#d97f86"/>' +
      '<path d="M29.4 37.5c1.6-.7 3.6-.7 5.2 0" stroke="#c0616c" stroke-width=".7" stroke-linecap="round" fill="none"/>' +
      '<path d="M28.6 37c1 2.4 5.8 2.4 6.8 0" stroke="#c0616c" stroke-width=".55" stroke-linecap="round" fill="none" opacity=".45"/>' +
      // 聴診器
      '<path d="M26.6 48.4c-2.2 6 .8 10.2 4.9 10.2 3.4 0 5.8-2.6 5.8-5.6" ' +
      'stroke="var(--mj-primary,#3f8fd0)" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
      '<circle cx="37.3" cy="52" r="2.7" fill="var(--mj-primary,#3f8fd0)" opacity=".9"/>' +
      '<circle cx="37.3" cy="52" r="1.1" fill="#ffffff" opacity=".9"/>' +
      '</g></svg>'
    );
  }

  function styles() {
    var t = config.character.theme;
    return (
      ":host{all:initial}" +
      "*,*::before,*::after{box-sizing:border-box}" +
      // display を指定した要素にも hidden を効かせる（UAスタイルより著者スタイルが強いため）
      "[hidden]{display:none!important}" +
      ".mj{" +
      "--mj-primary:" + t.primary + ";" +
      "--mj-primary-dark:" + t.primaryDark + ";" +
      "--mj-accent:" + t.accent + ";" +
      "--mj-bubble:" + t.bubble + ";" +
      "--mj-text:#1f2d33;--mj-muted:#6b7c85;--mj-line:#e4ebee;--mj-surface:#ffffff;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Noto Sans JP'," +
      "'Yu Gothic UI',Meiryo,sans-serif;color:var(--mj-text);pointer-events:none}" +
      ".mj *{pointer-events:auto}" +

      /* ランチャー */
      ".mj-launcher{position:fixed;bottom:20px;display:flex;align-items:center;gap:10px;" +
      "flex-direction:row-reverse;border:0;background:none;padding:0;cursor:pointer}" +
      ".mj-launcher.right{right:20px}.mj-launcher.left{left:20px;flex-direction:row}" +
      ".mj-launcher{transition:opacity .18s ease,transform .18s ease}" +
      ".mj-launcher.mj-tucked{opacity:0;transform:scale(.7);pointer-events:none}" +
      ".mj-fab{width:66px;height:66px;border-radius:50%;background:var(--mj-primary);" +
      "box-shadow:0 10px 26px rgba(15,60,50,.28);display:grid;place-items:center;" +
      "transition:transform .18s ease,box-shadow .18s ease;position:relative}" +
      ".mj-launcher:hover .mj-fab{transform:translateY(-3px) scale(1.04);box-shadow:0 14px 30px rgba(15,60,50,.34)}" +
      ".mj-launcher:focus-visible .mj-fab{outline:3px solid var(--mj-primary-dark);outline-offset:3px}" +
      ".mj-fab .mj-avatar-svg,.mj-fab .mj-avatar-img{border-radius:50%;display:block}" +
      ".mj-fab-label{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);" +
      "background:#fff;color:var(--mj-primary-dark);font-size:10px;font-weight:700;" +
      "padding:2px 8px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.14);white-space:nowrap}" +
      ".mj-pulse{position:absolute;inset:0;border-radius:50%;border:2px solid var(--mj-primary);" +
      "animation:mj-pulse 2.4s ease-out infinite}" +
      "@keyframes mj-pulse{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}" +
      ".mj-teaser{display:block;max-width:230px;background:#fff;border-radius:16px 16px 4px 16px;padding:10px 13px;" +
      "font-size:13px;line-height:1.55;box-shadow:0 8px 22px rgba(15,60,50,.16);" +
      "border:1px solid var(--mj-line);animation:mj-pop .3s ease}" +
      ".mj-teaser b{color:var(--mj-primary-dark)}" +
      ".mj-teaser-close{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;" +
      "border:1px solid var(--mj-line);background:#fff;color:var(--mj-muted);font-size:13px;line-height:1;cursor:pointer}" +
      ".mj-teaser-wrap{position:relative}" +
      "@keyframes mj-pop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}" +

      /* パネル */
      ".mj-panel{position:fixed;bottom:20px;width:392px;max-width:calc(100vw - 32px);height:min(640px,calc(100vh - 40px));" +
      "background:var(--mj-surface);border-radius:20px;box-shadow:0 24px 60px rgba(15,45,40,.28);" +
      "display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(14px) scale(.98);" +
      "transition:opacity .2s ease,transform .2s ease;pointer-events:none}" +
      ".mj-panel.right{right:20px}.mj-panel.left{left:20px}" +
      ".mj-panel.open{opacity:1;transform:none;pointer-events:auto}" +
      ".mj-head{background:linear-gradient(135deg,var(--mj-primary),var(--mj-primary-dark));" +
      "color:#fff;padding:14px 16px;display:flex;align-items:center;gap:11px}" +
      ".mj-head-avatar{width:44px;height:44px;border-radius:50%;background:#ffffff;overflow:hidden;" +
      "display:grid;place-items:center;flex:0 0 auto}" +
      ".mj-head-name{font-size:15px;font-weight:700;line-height:1.3}" +
      ".mj-head-sub{font-size:11px;opacity:.9;line-height:1.4;margin-top:2px}" +
      ".mj-head-meta{font-size:10px;opacity:.85;margin-top:3px;display:flex;align-items:center;gap:4px;white-space:nowrap}" +
      ".mj-dot{width:6px;height:6px;border-radius:50%;background:#7ef2c5;display:inline-block}" +
      ".mj-head-actions{margin-left:auto;display:flex;gap:4px}" +
      ".mj-icon-btn{width:30px;height:30px;border-radius:9px;border:0;background:rgba(255,255,255,.16);" +
      "color:#fff;cursor:pointer;font-size:15px;line-height:1;display:grid;place-items:center}" +
      ".mj-icon-btn:hover{background:rgba(255,255,255,.3)}" +

      ".mj-body{flex:1;overflow-y:auto;padding:16px 14px 6px;background:#f7fbfa;scroll-behavior:smooth}" +
      ".mj-row{display:flex;gap:8px;margin-bottom:12px;align-items:flex-end}" +
      ".mj-row.user{flex-direction:row-reverse}" +
      ".mj-row-avatar{width:32px;height:32px;border-radius:50%;background:var(--mj-bubble);" +
      "border:1px solid #d8e7f4;overflow:hidden;" +
      "display:grid;place-items:center;flex:0 0 auto}" +
      ".mj-bubble{max-width:78%;padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.75;" +
      "white-space:pre-wrap;word-break:break-word}" +
      ".mj-row.bot .mj-bubble{background:var(--mj-bubble);border:1px solid #dcefe8;border-bottom-left-radius:5px}" +
      ".mj-row.user .mj-bubble{background:var(--mj-primary);color:#fff;border-bottom-right-radius:5px}" +
      ".mj-bubble a{color:var(--mj-primary-dark);text-decoration:underline;word-break:break-all}" +
      ".mj-row.user .mj-bubble a{color:#fff}" +
      ".mj-sources{margin:6px 0 0 40px;font-size:11px;color:var(--mj-muted);line-height:1.7}" +
      ".mj-sources a{color:var(--mj-primary-dark);text-decoration:none;border-bottom:1px dotted}" +
      ".mj-sources-label{font-weight:700;margin-right:4px}" +
      ".mj-typing{display:flex;gap:4px;padding:4px 2px}" +
      ".mj-typing i{width:7px;height:7px;border-radius:50%;background:var(--mj-primary);opacity:.4;" +
      "animation:mj-blink 1.2s infinite}" +
      ".mj-typing i:nth-child(2){animation-delay:.2s}.mj-typing i:nth-child(3){animation-delay:.4s}" +
      "@keyframes mj-blink{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +

      ".mj-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;background:#f7fbfa}" +
      ".mj-chip{border:1px solid var(--mj-primary);color:var(--mj-primary-dark);background:#fff;" +
      "border-radius:999px;padding:7px 12px;font-size:12px;cursor:pointer;line-height:1.3}" +
      ".mj-chip:hover{background:var(--mj-bubble)}" +

      ".mj-foot{border-top:1px solid var(--mj-line);background:#fff;padding:10px 12px 8px}" +
      ".mj-input-row{display:flex;gap:8px;align-items:flex-end}" +
      ".mj-input{flex:1;border:1px solid var(--mj-line);border-radius:14px;padding:10px 12px;font-size:13.5px;" +
      "font-family:inherit;line-height:1.6;resize:none;max-height:96px;min-height:42px;outline:none;color:inherit}" +
      ".mj-input:focus{border-color:var(--mj-primary)}" +
      ".mj-send{width:42px;height:42px;border-radius:14px;border:0;background:var(--mj-primary);color:#fff;" +
      "cursor:pointer;display:grid;place-items:center;flex:0 0 auto}" +
      ".mj-send:disabled{opacity:.45;cursor:not-allowed}" +
      ".mj-disclaimer{font-size:10px;color:var(--mj-muted);line-height:1.6;margin-top:7px;text-align:center}" +

      "@media (max-width:520px){.mj-panel{right:0!important;left:0!important;bottom:0;width:100%;" +
      "max-width:100%;height:100%;border-radius:0}" +
      ".mj-head{padding-top:max(14px,env(safe-area-inset-top))}" +
      ".mj-foot{padding-bottom:max(8px,env(safe-area-inset-bottom))}" +
      ".mj-launcher{bottom:16px}.mj-launcher.right{right:14px}}" +
      "@media (prefers-reduced-motion:reduce){.mj-pulse{animation:none}.mj-panel{transition:none}" +
      ".mj-typing i{animation-duration:2s}}"
    );
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, "&#39;");
  }

  /** 本文中のURLをリンクにする */
  function renderText(text) {
    return escapeHtml(text).replace(/(https?:\/\/[^\s<>"'）)]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
    });
  }

  function buildUi() {
    var wrap = document.createElement("div");
    wrap.className = "mj";
    wrap.innerHTML =
      "<style>" + styles() + "</style>" +
      '<button class="mj-launcher ' + position + '" type="button" aria-haspopup="dialog"' +
      ' aria-label="' + escapeAttr(config.character.name) + 'に質問する">' +
      '<span class="mj-fab"><span class="mj-pulse"></span>' + avatarSvg(46) +
      '<span class="mj-fab-label">AIに質問</span></span>' +
      '<span class="mj-teaser-wrap" hidden><span class="mj-teaser">' +
      "<b>" + escapeHtml(config.character.name) + "</b>です。" +
      escapeHtml(config.character.tagline || "ご質問にお答えします。") +
      '</span><span class="mj-teaser-close" role="presentation">×</span></span>' +
      "</button>" +

      '<section class="mj-panel ' + position + '" role="dialog" aria-modal="false"' +
      ' aria-label="' + escapeAttr(config.character.name) + ' チャット" hidden>' +
      '<header class="mj-head">' +
      '<span class="mj-head-avatar">' + avatarSvg(42) + "</span>" +
      "<div><div class=\"mj-head-name\">" + escapeHtml(config.character.name) + "</div>" +
      '<div class="mj-head-sub">' + escapeHtml(config.character.title) + "</div>" +
      '<div class="mj-head-meta"><span class="mj-dot"></span><span class="mj-updated"></span></div></div>' +
      '<div class="mj-head-actions">' +
      '<button class="mj-icon-btn mj-reset" type="button" title="会話をリセット" aria-label="会話をリセット">↺</button>' +
      '<button class="mj-icon-btn mj-close" type="button" title="閉じる" aria-label="閉じる">×</button>' +
      "</div></header>" +
      '<div class="mj-body" role="log" aria-live="polite" aria-atomic="false"></div>' +
      '<div class="mj-chips"></div>' +
      '<div class="mj-foot"><div class="mj-input-row">' +
      '<textarea class="mj-input" rows="1" placeholder="ご質問を入力してください" aria-label="ご質問"></textarea>' +
      '<button class="mj-send" type="button" aria-label="送信">' +
      '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
      '<path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" fill="currentColor"/></svg>' +
      "</button></div>" +
      '<div class="mj-disclaimer"></div></div>' +
      "</section>";

    shadow.appendChild(wrap);

    el.launcher = wrap.querySelector(".mj-launcher");
    el.teaserWrap = wrap.querySelector(".mj-teaser-wrap");
    el.teaserClose = wrap.querySelector(".mj-teaser-close");
    el.panel = wrap.querySelector(".mj-panel");
    el.body = wrap.querySelector(".mj-body");
    el.chips = wrap.querySelector(".mj-chips");
    el.input = wrap.querySelector(".mj-input");
    el.send = wrap.querySelector(".mj-send");
    el.close = wrap.querySelector(".mj-close");
    el.reset = wrap.querySelector(".mj-reset");
    el.updated = wrap.querySelector(".mj-updated");
    el.disclaimer = wrap.querySelector(".mj-disclaimer");

    el.disclaimer.textContent = config.disclaimer;
    renderUpdated();
    renderChips();

    el.launcher.addEventListener("click", function (event) {
      if (event.target === el.teaserClose) {
        el.teaserWrap.hidden = true;
        return;
      }
      toggle();
    });
    el.close.addEventListener("click", close);
    el.reset.addEventListener("click", resetConversation);
    el.send.addEventListener("click", submit);
    el.input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        submit();
      }
    });
    el.input.addEventListener("input", function () {
      el.input.style.height = "auto";
      el.input.style.height = Math.min(el.input.scrollHeight, 96) + "px";
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.open) close();
    });
  }

  function renderUpdated() {
    var updatedAt = config.knowledge.updatedAt;
    var stamp = "";
    if (updatedAt && new Date(updatedAt).getTime() > 0) {
      var d = new Date(updatedAt);
      stamp =
        "最新情報 " + (d.getMonth() + 1) + "/" + d.getDate() + " " +
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0") + " 反映";
    } else {
      stamp = "オンライン";
    }
    el.updated.textContent = stamp;
  }

  function renderChips() {
    el.chips.innerHTML = "";
    if (state.transcript.length > 1) return;
    (config.suggestions || []).forEach(function (text) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "mj-chip";
      chip.textContent = text;
      chip.addEventListener("click", function () {
        if (state.busy) return;
        el.input.value = text;
        submit();
      });
      el.chips.appendChild(chip);
    });
  }

  /* ------------------------------------------------------------ *
   * 表示
   * ------------------------------------------------------------ */

  function addRow(role, text) {
    var row = document.createElement("div");
    row.className = "mj-row " + (role === "user" ? "user" : "bot");
    var bubble = document.createElement("div");
    bubble.className = "mj-bubble";
    if (role === "user") {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = renderText(text || "");
      var avatar = document.createElement("span");
      avatar.className = "mj-row-avatar";
      avatar.innerHTML = avatarSvg(30);
      row.appendChild(avatar);
    }
    row.appendChild(bubble);
    el.body.appendChild(row);
    scrollToEnd();
    return bubble;
  }

  function addTyping() {
    var row = document.createElement("div");
    row.className = "mj-row bot mj-typing-row";
    row.innerHTML =
      '<span class="mj-row-avatar">' + avatarSvg(30) + "</span>" +
      '<div class="mj-bubble"><span class="mj-typing"><i></i><i></i><i></i></span></div>';
    el.body.appendChild(row);
    scrollToEnd();
    return row;
  }

  function addSources(sources) {
    if (!sources || sources.length === 0) return;
    var box = document.createElement("div");
    box.className = "mj-sources";
    var html = '<span class="mj-sources-label">参考ページ</span>';
    html += sources
      .slice(0, 3)
      .map(function (s) {
        return (
          '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(shortTitle(s.title || s.url)) + "</a>"
        );
      })
      .join("、");
    box.innerHTML = html;
    el.body.appendChild(box);
    scrollToEnd();
  }

  /** 「料金表 | テスト美容内科」のようなタイトルを短くする */
  function shortTitle(title) {
    var head = String(title).split(/\s*[|｜\-–—]\s*/)[0] || String(title);
    return head.length > 18 ? head.slice(0, 18) + "…" : head;
  }

  function scrollToEnd() {
    el.body.scrollTop = el.body.scrollHeight;
  }

  function restoreTranscript() {
    el.body.innerHTML = "";
    if (state.transcript.length === 0) {
      state.transcript.push({ role: "bot", text: config.greeting });
    }
    state.transcript.forEach(function (entry) {
      addRow(entry.role, entry.text);
      if (entry.sources) addSources(entry.sources);
    });
  }

  /* ------------------------------------------------------------ *
   * 送信（SSEストリームを読みながら1文字ずつ表示）
   * ------------------------------------------------------------ */

  function submit() {
    var text = (el.input.value || "").trim();
    if (!text || state.busy) return;
    el.input.value = "";
    el.input.style.height = "auto";
    send(text);
  }

  function send(text) {
    state.busy = true;
    el.send.disabled = true;
    el.chips.innerHTML = "";
    addRow("user", text);
    state.transcript.push({ role: "user", text: text });
    var typing = addTyping();
    var bubble = null;
    var answer = "";
    var sources = [];

    var finish = function () {
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      state.busy = false;
      el.send.disabled = false;
      if (answer) {
        state.transcript.push({ role: "bot", text: answer, sources: sources });
        saveTranscript();
      }
      if (sources.length > 0) addSources(sources);
      el.input.focus();
    };

    var onDelta = function (chunk) {
      if (!bubble) {
        if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
        typing = null;
        bubble = addRow("bot", "");
      }
      answer += chunk;
      bubble.innerHTML = renderText(answer);
      scrollToEnd();
    };

    fetch(apiBase + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId(), message: text }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              throw new Error(data.error || "サーバーエラー (" + res.status + ")");
            });
        }
        if (!res.body || !res.body.getReader) {
          return res.text().then(function (raw) {
            parseSse(raw, onDelta, function (list) {
              sources = list;
            });
          });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        var pump = function () {
          return reader.read().then(function (result) {
            if (result.done) {
              if (buffer) {
                parseSse(buffer, onDelta, function (list) {
                  sources = list;
                });
              }
              return;
            }
            buffer += decoder.decode(result.value, { stream: true });
            var blocks = buffer.split("\n\n");
            buffer = blocks.pop() || "";
            blocks.forEach(function (block) {
              parseSse(block, onDelta, function (list) {
                sources = list;
              });
            });
            return pump();
          });
        };
        return pump();
      })
      .catch(function (err) {
        onDelta(
          "通信がうまくいきませんでした。恐れ入りますが、少し時間をおいてもう一度お試しください。\n（" +
            (err && err.message ? err.message : "不明なエラー") + "）",
        );
      })
      .then(finish, finish);
  }

  function parseSse(block, onDelta, onSources) {
    block.split("\n\n").forEach(function (chunk) {
      var event = "message";
      var dataLines = [];
      chunk.split("\n").forEach(function (line) {
        if (line.indexOf("event:") === 0) event = line.slice(6).trim();
        else if (line.indexOf("data:") === 0) dataLines.push(line.slice(5).trim());
      });
      if (dataLines.length === 0) return;
      var payload;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch (e) {
        return;
      }
      if (event === "delta" && payload.text) onDelta(payload.text);
      else if (event === "sources" && payload.sources) onSources(payload.sources);
      else if (event === "done" && payload.sources && payload.sources.length) onSources(payload.sources);
      else if (event === "error") onDelta("エラーが発生しました。");
    });
  }

  /* ------------------------------------------------------------ *
   * 開閉
   * ------------------------------------------------------------ */

  function open() {
    if (!state.booted) return;
    state.open = true;
    el.teaserWrap.hidden = true;
    el.panel.hidden = false;
    // hidden 解除直後にトランジションを効かせる
    window.requestAnimationFrame(function () {
      el.panel.classList.add("open");
    });
    el.launcher.setAttribute("aria-expanded", "true");
    el.launcher.classList.add("mj-tucked");
    scrollToEnd();
    if (window.matchMedia("(min-width:521px)").matches) el.input.focus();
    refreshStatus();
  }

  function close() {
    state.open = false;
    el.panel.classList.remove("open");
    el.launcher.setAttribute("aria-expanded", "false");
    el.launcher.classList.remove("mj-tucked");
    window.setTimeout(function () {
      if (!state.open) el.panel.hidden = true;
    }, 220);
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  function resetConversation() {
    fetch(apiBase + "/api/chat/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId() }),
    }).catch(function () {
      /* リセットはサーバー側が落ちていても画面だけ初期化する */
    });
    state.transcript = [{ role: "bot", text: config.greeting }];
    saveTranscript();
    restoreTranscript();
    renderChips();
  }

  /** パネルを開くたびに最新情報の更新時刻だけ取り直す */
  function refreshStatus() {
    fetch(apiBase + "/api/config", { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.knowledge) {
          config.knowledge = data.knowledge;
          renderUpdated();
        }
      })
      .catch(function () {
        /* 表示は据え置き */
      });
  }

  /* ------------------------------------------------------------ *
   * 起動
   * ------------------------------------------------------------ */

  function boot() {
    fetch(apiBase + "/api/config", { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.character) {
          config = Object.assign(config, data);
          config.character.theme = Object.assign(
            { primary: "#12b48a", primaryDark: "#0d8f6d", accent: "#ffd166", bubble: "#eefaf6", avatarUrl: "" },
            data.character.theme || {},
          );
        }
      })
      .catch(function () {
        /* サーバー未起動でもボタンは出す（押すとエラーを案内） */
      })
      .then(function () {
        document.body.appendChild(host);
        buildUi();
        state.transcript = loadTranscript();
        restoreTranscript();
        state.booted = true;
        if (autoTeaser && state.transcript.length <= 1) {
          window.setTimeout(function () {
            if (!state.open) el.teaserWrap.hidden = false;
          }, 3500);
        }
        if (location.hash === "#chat") open();
      });
  }

  window.ManjaroChat = {
    open: open,
    close: close,
    toggle: toggle,
    reset: resetConversation,
    ask: function (text) {
      open();
      if (text) send(String(text));
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
