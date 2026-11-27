/* =====================================================
   トップページと定期活動ページで共通に使う部品
   （日付の書き方・CSVの読み込み・定期活動データ）
   ===================================================== */
(function () {
  "use strict";
  const CFG = window.SITE_CONFIG || {};
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const TODAY = ymd(today);

  /* 日付の書き方はサイト全体でこれに統一：2026年11月28日（土） */
  const jp = s => { const d = typeof s === "string" ? parse(s) : s; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };
  /* 期間：2026年12月31日（木）〜2027年1月2日（土） */
  const jpRange = (s, e) => e && e !== s ? `${jp(s)}〜${jp(e)}` : jp(s);

  // "2026/12/5" "2026-12-05" "2026/12/05 1:38:00" などを "2026-12-05" に
  function normDate(v) {
    const m = String(v || "").match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
    return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : "";
  }
  const truthy = v => /^(true|1|yes|はい|ok|○|◯|可)$/i.test(String(v || "").trim());
  const safeUrl = v => /^https?:\/\/\S+$/i.test(String(v || "").trim()) ? String(v).trim() : "";

  // CSVパーサ（改行・カンマ・ダブルクォート入りのセルに対応）
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim());
    return rows.filter(r => r.some(c => c.trim() !== "")).map(r => {
      const o = {}; head.forEach((h, i) => { if (h) o[h] = (r[i] || "").trim(); }); return o;
    });
  }

  // スプレッドシート（CSV）→ だめなら JSON ファイル
  async function loadRows(csvUrl, jsonPath) {
    if (csvUrl) {
      try {
        const res = await fetch(csvUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        return parseCSV(await res.text());
      } catch (e) { console.warn(jsonPath + " を代わりに使います", e); }
    }
    const res = await fetch(jsonPath, { cache: "no-store" });
    return res.ok ? res.json() : [];
  }

  /* ---------- 定期活動・サークル ---------- */
  const RCATS = {
    "スポーツ":       { label: "スポーツ",       bg: "#e1effa", fg: "#1f5f95" },
    "健康・運動":     { label: "健康・運動",     bg: "#dff4ef", fg: "#0d7a66" },
    "文化・趣味":     { label: "文化・趣味",     bg: "#ece7ff", fg: "#5a3fe0" },
    "子ども・子育て": { label: "子ども・子育て", bg: "#fff3d1", fg: "#7a5600" },
    "その他":         { label: "その他",         bg: "#eef1f3", fg: "#55626e" }
  };
  const nk = s => String(s || "").normalize("NFKC").replace(/\s+/g, "");
  const rcatOf = name => {
    const k = Object.keys(RCATS).find(c => nk(c) === nk(name));
    return k ? RCATS[k] : { label: String(name || "その他").trim() || "その他", bg: RCATS["その他"].bg, fg: RCATS["その他"].fg };
  };

  // 「火・金」「水曜」「毎日」→ [2, 5] など（0=日）
  function parseDays(v) {
    const s = nk(v);
    if (/毎日/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
    const out = [];
    WD.forEach((w, i) => { if (s.includes(w)) out.push(i); });
    if (/平日/.test(s)) [1, 2, 3, 4, 5].forEach(i => out.includes(i) || out.push(i));
    return out.sort();
  }
  // 「毎週」→ weekly、「第1・第3」「第2,4」→ [1,3]、「最終」→ 5（最終週）、それ以外（隔週・不定期など）→ カレンダーには出さない
  function parseFreq(v) {
    const s = nk(v);
    if (!s || /毎週|毎日/.test(s)) return { weekly: true, nth: [] };
    const nth = [];
    // 「第2・第4」「第2,4」「第1と第3」など：「第」より後ろの数字を全部拾う
    if (s.includes("第")) (s.slice(s.indexOf("第")).match(/\d/g) || []).map(Number).filter(n => n >= 1 && n <= 5).forEach(n => nth.push(n));
    if (/最終/.test(s)) nth.push(-1);
    return { weekly: false, nth };
  }

  function normalizeRegular(list) {
    return (list || [])
      .map(r => ({
        name: r.name || r["活動名"] || "",
        cat: rcatOf(r.category || r["カテゴリ"]),
        catName: rcatOf(r.category || r["カテゴリ"]).label,
        daysText: r.weekdays || r["曜日"] || "",
        freqText: r.frequency || r["頻度"] || "",
        time: r.time || r["時間"] || "",
        place: r.place || r["場所"] || "",
        target: r.target || r["対象"] || "",
        price: r.price || r["参加費"] || "",
        visit: truthy(r.visit != null ? r.visit : r["見学OK"]),
        contact: r.contact || r["問い合わせ先"] || "",
        checked: normDate(r.checked || r["最終確認日"]),
        desc: r.description || r["説明"] || ""
      }))
      .filter(r => r.name.trim())
      .map((r, i) => Object.assign(r, { id: "rg" + i, days: parseDays(r.daysText), freq: parseFreq(r.freqText) }));
  }

  // その日に活動があるか
  function occursOn(r, d) {
    if (!r.days.includes(d.getDay())) return false;
    if (r.freq.weekly) return true;
    const n = Math.ceil(d.getDate() / 7);
    const last = addDays(d, 7).getMonth() !== d.getMonth();
    return r.freq.nth.includes(n) || (last && r.freq.nth.includes(-1));
  }

  // 「毎週 水曜 19:00〜21:00」
  function whenText(r) {
    const days = r.days.length ? r.days.map(i => WD[i]).join("・") + "曜" : r.daysText;
    const f = r.freqText || "毎週";
    return [f, days, r.time].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  // 問い合わせ先：URL・メール・電話ならリンクにする
  function contactLink(v) {
    const s = String(v || "").trim();
    if (safeUrl(s)) return { href: s, label: "問い合わせる", ext: true };
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s)) return { href: "mailto:" + s, label: "メールで問い合わせ" };
    const tel = s.replace(/[^\d+]/g, "");
    if (/^[\d\-+()（） ]+$/.test(s) && tel.length >= 9) return { href: "tel:" + tel, label: "電話で問い合わせ" };
    return null;
  }

  // トップの帯に出す順番：今日・明日にあるもの → 最近確認・更新したもの
  function pickForTop(list, n) {
    const t1 = addDays(today, 1);
    const rank = r => occursOn(r, today) ? 0 : occursOn(r, t1) ? 1 : 2;
    return [...list].sort((a, b) => rank(a) - rank(b) || (b.checked || "").localeCompare(a.checked || "")).slice(0, n);
  }

  const loadRegular = () => loadRows(CFG.REGULAR_CSV_URL, "data/regular.json").then(normalizeRegular);

  // 公式LINEの友だち追加ボタン（config.js の LINE_URL があるときだけ表示）
  if (safeUrl(CFG.LINE_URL)) {
    document.querySelectorAll("[data-line-link]").forEach(a => { a.href = CFG.LINE_URL; });
    document.querySelectorAll("[data-line]").forEach(el => el.classList.remove("hidden"));
  }

  window.HC = {
    CFG, WD, esc, pad, ymd, parse, addDays, today, TODAY, jp, jpRange, normDate, truthy, safeUrl,
    parseCSV, loadRows, RCATS, rcatOf, loadRegular, occursOn, whenText, contactLink, pickForTop
  };
})();
