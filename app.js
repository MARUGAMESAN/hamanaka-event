(function () {
  "use strict";
  const CFG = window.SITE_CONFIG || {};

  /* ---------- カテゴリ（フォームの選択肢と同じ名前にする） ---------- */
  // key が "youth" のカテゴリはトップの「若者イベント」に大きく表示される
  const CATS = {
    // --- 申請フォームの選択肢 ---
    "若者限定":         { key: "youth",   label: "若者限定",       color: "#ff6b4a", bg: "#ffe8e1", fg: "#c8401f" },
    "スポーツ関連":     { key: "sports",  label: "スポーツ",       color: "#2f7fc1", bg: "#e1effa", fg: "#1f5f95" },
    "フード関連":       { key: "food",    label: "フード",         color: "#d9534f", bg: "#fbe3e2", fg: "#a8322e" },
    "座談会":           { key: "talk",    label: "座談会",         color: "#b5793a", bg: "#f6ebdd", fg: "#7f5220" },
    "町内イベント（中〜大規模）": { key: "town", label: "町内イベント", color: "#7a5cff", bg: "#ece7ff", fg: "#5a3fe0" },
    "親睦会（交流会）": { key: "social",  label: "交流会",         color: "#e2668f", bg: "#fbe4ec", fg: "#a83b62" },
    "動物関連":         { key: "animal",  label: "動物",           color: "#5b9a3c", bg: "#e5f2dc", fg: "#3e6f26" },
    "オンラインイベント": { key: "online", label: "オンライン",     color: "#2aa7c9", bg: "#ddf2f8", fg: "#17728c" },
    // --- 旧カテゴリ（初期データ用） ---
    "若者向け":         { key: "youth",   label: "若者",           color: "#ff6b4a", bg: "#ffe8e1", fg: "#c8401f" },
    "音楽":             { key: "music",   label: "音楽",           color: "#7a5cff", bg: "#ece7ff", fg: "#5a3fe0" },
    "文化・体験":       { key: "culture", label: "文化・体験",     color: "#1aa38a", bg: "#dff4ef", fg: "#0d7a66" },
    "子ども・ファミリー": { key: "family",  label: "子ども・ファミリー", color: "#f2a900", bg: "#fff3d1", fg: "#8a6200" },
    "スポーツ":         { key: "sports",  label: "スポーツ",       color: "#2f7fc1", bg: "#e1effa", fg: "#1f5f95" },
    "食・グルメ":       { key: "food",    label: "食・グルメ",     color: "#d9534f", bg: "#fbe3e2", fg: "#a8322e" },
    "その他":           { key: "other",   label: "その他",         color: "#8a97a3", bg: "#eef1f3", fg: "#55626e" }
  };
  // 全角/半角のカッコ・スペースの違いは無視して照合する
  const catKey = s => String(s || "").normalize("NFKC").replace(/\s+/g, "").replace(/[〜～~]/g, "~");
  const CAT_INDEX = {};
  Object.keys(CATS).forEach(k => CAT_INDEX[catKey(k)] = CATS[k]);
  const catOf = name => CAT_INDEX[catKey(name)] || CATS["その他"];
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  /* ---------- ユーティリティ ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const weekStart = d => addDays(d, -((d.getDay() + 6) % 7)); // 月曜はじまり
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const TODAY = ymd(today);
  const daysUntil = s => Math.round((parse(s) - today) / 864e5);
  const jp = s => { const d = parse(s); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };

  // "2026/12/5" "2026-12-05" "2026/12/05 1:38:00" などを "2026-12-05" に
  function normDate(v) {
    const m = String(v || "").match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
    return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : "";
  }
  const truthy = v => /^(true|1|yes|はい|○|◯)$/i.test(String(v || "").trim());
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
      const o = {}; head.forEach((h, i) => o[h] = (r[i] || "").trim()); return o;
    });
  }

  function normalize(list) {
    return list
      .filter(r => (r.title || "").trim())
      .map((r, i) => ({
        id: "ev" + i,
        title: r.title.trim(),
        date: normDate(r.date) || null,
        time: r.time || "",
        place: r.place || "",
        cat: catOf(r.category),
        price: r.price || "",
        capacity: r.capacity || "",
        deadline: normDate(r.deadline),
        apply: r.apply || "",
        desc: r.description || "",
        organizer: r.organizer || "",
        posted: normDate(r.posted) || "2000-01-01",
        tentative: truthy(r.tentative)
      }));
  }

  async function loadEvents() {
    if (CFG.SHEET_CSV_URL) {
      try {
        const res = await fetch(CFG.SHEET_CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        return normalize(parseCSV(await res.text()));
      } catch (e) { console.warn("スプレッドシートの読み込みに失敗。events.json を使います", e); }
    }
    const res = await fetch("data/events.json", { cache: "no-store" });
    return normalize(await res.json());
  }

  /* ---------- 描画 ---------- */
  let EVENTS = [], dated = [], byDate = {};
  const $ = id => document.getElementById(id);

  function dateBox(s) {
    const d = parse(s);
    return `<div class="datebox"><div class="m">${d.getMonth() + 1}月</div><div class="d">${d.getDate()}</div><div class="w">${WD[d.getDay()]}</div></div>`;
  }
  const tag = c => `<span class="tag" style="background:${c.bg};color:${c.fg}">${esc(c.label)}</span>`;
  const dot = c => `<span class="dot" style="background:${c.color}"></span>`;
  const where = e => esc(e.time) + (e.time && e.place ? "｜" : "") + esc(e.place);

  function renderYouth() {
    const up = dated.filter(e => e.cat.key === "youth" && e.date >= TODAY);
    $("youthGrid").innerHTML = up.length ? up.map(e => {
      const n = daysUntil(e.date);
      const c = n === 0 ? "今日開催！" : n === 1 ? "明日開催！" : `あと${n}日`;
      return `<div class="ycard" data-id="${e.id}">${dateBox(e.date)}<div>
        <h3>${esc(e.title)}</h3><div class="meta">${where(e)}</div>
        <span class="count">${c}</span></div></div>`;
    }).join("") : `<div class="youth-empty">次の若者イベントは準備中です。お楽しみに！</div>`;
  }

  function renderNews() {
    const list = [...EVENTS].sort((a, b) => b.posted.localeCompare(a.posted)).slice(0, 8);
    $("news").innerHTML = list.map(e => {
      const p = parse(e.posted);
      const isNew = (today - p) / 864e5 <= 7;
      const when = e.date ? jp(e.date) + (e.tentative ? "（予定）" : "") : "日程調整中";
      return `<li data-id="${e.id}"><span class="posted">${p.getMonth() + 1}/${p.getDate()} 掲載</span>
        <span class="title">${esc(e.title)}${isNew ? '<span class="new-badge">NEW</span>' : ""}<br><span class="meta">${when}</span></span>${tag(e.cat)}</li>`;
    }).join("") || `<li class="empty">まだ掲載情報はありません</li>`;
  }

  let view = "month", cur = new Date(today.getFullYear(), today.getMonth(), 1), selected = null;

  const dotsFor = s => byDate[s] ? `<div class="dots">${byDate[s].slice(0, 3).map(e => dot(e.cat)).join("")}</div>` : `<div class="dots"></div>`;

  function evRow(e) {
    const past = e.date < TODAY;
    return `<div class="ev ${e.cat.key === "youth" ? "y" : ""} ${past ? "past" : ""}" data-id="${e.id}">${dateBox(e.date)}<div>
      ${tag(e.cat)}${e.tentative ? ' <span class="tag" style="background:#fff4d6;color:#8a6200">日程予定</span>' : ""}${past ? ' <span class="tag" style="background:#eee;color:#888">終了</span>' : ""}
      <h4>${esc(e.title)}</h4><div class="meta">${where(e)}</div></div></div>`;
  }
  function renderList(title, evs, emptyMsg) {
    $("listArea").innerHTML = `<p class="list-title">${title}</p><div class="list">${evs.length ? evs.map(evRow).join("") : `<div class="empty">${emptyMsg}</div>`}</div>`;
  }

  function renderMonth() {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1), start = addDays(first, -first.getDay());
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), s = ymd(d);
      if (i >= 35 && d.getMonth() !== m) break;
      const has = !!byDate[s], yy = has && byDate[s].some(e => e.cat.key === "youth");
      const cls = ["cell", d.getMonth() !== m ? "out" : "", has ? "has" : "", yy ? "y" : "", s === TODAY ? "today" : "", s === selected ? "sel" : ""].join(" ");
      cells += `<div class="${cls}" ${has ? `data-day="${s}"` : ""}>${d.getDate()}${dotsFor(s)}</div>`;
    }
    const used = [...new Set(dated.map(e => e.cat))];
    $("calCard").innerHTML = `
      <div class="cal-nav"><button class="navbtn" data-nav="-1" aria-label="前の月">‹</button>
        <h3>${y}年 ${m + 1}月</h3><button class="navbtn" data-nav="1" aria-label="次の月">›</button></div>
      <div class="grid">${WD.map((w, i) => `<div class="dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</div>`).join("")}${cells}</div>
      <div class="legend">${used.map(c => `<span>${dot(c)}${esc(c.label)}</span>`).join("")}<span>日付をタップでその日のイベントを表示</span></div>`;

    if (selected) renderList(`${jp(selected)}のイベント`, byDate[selected] || [], "この日のイベントはありません");
    else {
      const prefix = `${y}-${pad(m + 1)}`;
      renderList(`${m + 1}月のイベント`, dated.filter(e => e.date.startsWith(prefix)), `${m + 1}月のイベントはまだありません`);
    }
  }

  function renderWeek(offset) {
    const s = addDays(weekStart(today), offset * 7), e = addDays(s, 6);
    let days = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i), k = ymd(d);
      days += `<div class="wday ${byDate[k] ? "has" : ""} ${k === TODAY ? "today" : ""}"><div class="wd">${WD[d.getDay()]}</div><div class="dn">${d.getDate()}</div>${dotsFor(k)}</div>`;
    }
    const name = offset ? "来週" : "今週";
    const label = `${s.getMonth() + 1}/${s.getDate()}（月）〜 ${e.getMonth() + 1}/${e.getDate()}（日）`;
    $("calCard").innerHTML = `<div class="cal-nav"><h3>${name}<span class="meta" style="font-weight:500;margin-left:8px">${label}</span></h3></div><div class="week">${days}</div>`;
    renderList(`${name}のイベント`, dated.filter(x => x.date >= ymd(s) && x.date <= ymd(e)), `${name}のイベントはありません`);
  }

  const renderCal = () => view === "month" ? renderMonth() : renderWeek(view === "next" ? 1 : 0);

  function renderTbd() {
    const t = EVENTS.filter(e => !e.date);
    $("tbdSec").classList.toggle("hidden", !t.length);
    $("tbd").innerHTML = t.map(e => `<div data-id="${e.id}">${esc(e.title)}<small>日程調整中</small></div>`).join("");
  }

  function openModal(id) {
    const e = EVENTS.find(x => x.id === id); if (!e) return;
    const url = safeUrl(e.apply);
    const rows = [
      ["日時", e.date ? jp(e.date) + (e.tentative ? "（予定）" : "") + (e.time ? " " + esc(e.time) : "") : "日程調整中"],
      ["場所", esc(e.place)], ["参加費", esc(e.price)], ["定員", esc(e.capacity)],
      ["申込締切", e.deadline ? jp(e.deadline) : ""],
      ["申込方法", url ? "" : esc(e.apply)], ["主催", esc(e.organizer)]
    ].filter(r => r[1]);
    $("modal").innerHTML = `<button class="close" aria-label="閉じる">×</button>${tag(e.cat)}
      <h3>${esc(e.title)}</h3><p>${esc(e.desc)}</p>
      <dl>${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("")}</dl>
      ${url ? `<a class="cta" href="${esc(url)}" target="_blank" rel="noopener">申し込み・詳細はこちら</a>` : ""}
      ${e.tentative ? '<div class="note">日程は予定です。変更になる場合があります。</div>' : ""}`;
    $("modalBg").classList.add("open");
  }

  /* ---------- イベント操作 ---------- */
  document.querySelector(".switch").addEventListener("click", ev => {
    const b = ev.target.closest("button"); if (!b) return;
    document.querySelectorAll(".switch button").forEach(x => x.classList.toggle("on", x === b));
    view = b.dataset.view; selected = null;
    if (view === "month") cur = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCal();
  });
  $("calCard").addEventListener("click", ev => {
    const nav = ev.target.closest("[data-nav]");
    if (nav) { cur = new Date(cur.getFullYear(), cur.getMonth() + Number(nav.dataset.nav), 1); selected = null; return renderMonth(); }
    const c = ev.target.closest("[data-day]"); if (!c) return;
    selected = selected === c.dataset.day ? null : c.dataset.day;
    renderMonth();
  });
  $("modalBg").addEventListener("click", ev => { if (ev.target === $("modalBg") || ev.target.closest(".close")) $("modalBg").classList.remove("open"); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") $("modalBg").classList.remove("open"); });
  document.body.addEventListener("click", ev => {
    if (ev.target.closest(".modal")) return;
    const t = ev.target.closest("[data-id]"); if (t) openModal(t.dataset.id);
  });

  /* ---------- 起動 ---------- */
  $("todayPill").textContent = `今日は ${today.getFullYear()}年${jp(TODAY)}`;
  $("operator").textContent = CFG.OPERATOR || "";
  if (safeUrl(CFG.FORM_URL)) {
    ["postBtnTop", "postBtn"].forEach(id => $(id).href = CFG.FORM_URL);
    $("postBtnTop").classList.remove("hidden");
    $("postSec").classList.remove("hidden");
  }

  loadEvents().then(list => {
    EVENTS = list;
    dated = EVENTS.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
    byDate = {};
    dated.forEach(e => (byDate[e.date] = byDate[e.date] || []).push(e));
    $("loading").remove();
    renderYouth(); renderNews(); renderCal(); renderTbd();
  }).catch(err => {
    $("loading").textContent = "イベント情報を読み込めませんでした。時間をおいて再度お試しください。";
    console.error(err);
  });
})();
