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
  const { WD, esc, pad, ymd, parse, addDays, today, TODAY, jp, jpRange, normDate, truthy, safeUrl, parseCSV, holidayName } = window.HC;
  const weekStart = d => addDays(d, -((d.getDay() + 6) % 7)); // 月曜はじまり
  const daysUntil = s => Math.round((parse(s) - today) / 864e5);

  // イベントごとの固定ID（イベント名＋掲載日から作る。共有リンク ?e=xxxx に使う）
  const hashId = str => { let h = 5381; for (const ch of str) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return "e" + h.toString(36); };

  // 「2026/11/26 1:38:00」→「2026-11-26 01:38:00」（並べ替え用。時刻がなければ日付だけ）
  function postedKey(v) {
    const d = normDate(v) || "2000-01-01";
    const t = String(v || "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return t ? `${d} ${pad(t[1])}:${t[2]}:${t[3] || "00"}` : d;
  }

  function normalize(list) {
    const used = {};
    return list
      .filter(r => (r.title || "").trim())
      .map(r => {
        let id = hashId(r.title.trim() + "|" + (normDate(r.posted) || ""));
        while (used[id]) id += "x";
        used[id] = 1;
        return Object.assign({ id }, r);
      })
      .map((r, i) => ({
        id: r.id,
        row: i,
        postedAt: postedKey(r.posted),
        title: r.title.trim(),
        date: normDate(r.date) || null,
        end: normDate(r.end || r.endDate || r["終了日"]) || null,
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
        tentative: truthy(r.tentative),
        conditions: r.conditions || "",
        images: [r.image1, r.image2].flatMap(driveImgs)
      }));
  }

  /* Googleフォームの画像（ドライブのURL）→ 表示用URL */
  function driveImgs(v) {
    return String(v || "").split(/[\s,]+/).map(u => {
      const m = u.match(/[?&]id=([\w-]{10,})/) || u.match(/\/d\/([\w-]{10,})/);
      if (m) return { thumb: `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`, full: `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`, link: `https://drive.google.com/file/d/${m[1]}/view` };
      return /^https:\/\/\S+\.(jpe?g|png|gif|webp)(\?\S*)?$/i.test(u) ? { thumb: u, full: u, link: u } : null;
    }).filter(Boolean);
  }

  const loadEvents = () => window.HC.loadRows(CFG.SHEET_CSV_URL, "data/events.json").then(normalize);
  // 開催日の表示（期間・予定つき）
  const whenOf = e => e.date ? jpRange(e.date, e.end) + (e.tentative ? "（予定）" : "") : "日程調整中";
  const lastDay = e => e.end && e.end > e.date ? e.end : e.date;

  /* ---------- 描画 ---------- */
  let EVENTS = [], dated = [], byDate = {}, REGULAR = [], showRegular = false;
  const $ = id => document.getElementById(id);

  function dateBox(s) {
    const d = parse(s);
    return `<div class="datebox"><div class="m">${d.getMonth() + 1}月</div><div class="d">${d.getDate()}</div><div class="w">${WD[d.getDay()]}</div></div>`;
  }
  const tag = c => `<span class="tag" style="background:${c.bg};color:${c.fg}">${esc(c.label)}</span>`;
  const dot = c => `<span class="dot" style="background:${c.color}"></span>`;
  const where = e => esc(e.time) + (e.time && e.place ? "｜" : "") + esc(e.place);
  const regOn = d => showRegular ? REGULAR.filter(r => window.HC.occursOn(r, d)) : [];

  function renderYouth() {
    const up = dated.filter(e => e.cat.key === "youth" && lastDay(e) >= TODAY);
    $("youthGrid").innerHTML = up.length ? up.slice(0, 1).map(e => {
      const n = daysUntil(e.date);
      const c = n <= 0 ? (n < 0 ? "開催中！" : "今日開催！") : n === 1 ? "明日開催！" : `あと${n}日`;
      return `<div class="ycard" data-id="${e.id}">${dateBox(e.date)}<div>
        <h3>${esc(e.title)}</h3><div class="date-line">${whenOf(e)}</div><div class="meta">${where(e)}</div>
        <span class="count">${c}</span></div>${e.images.length ? `<img class="thumb" src="${esc(e.images[0].thumb)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>`;
    }).join("") + (up.length > 1 ? `<p class="youth-more">ほかにも若者イベントが${up.length - 1}件あります（カレンダーに表示しています）</p>` : "") : `<div class="youth-empty">次の若者イベントは準備中です。お楽しみに！</div>`;
  }

  function renderNews() {
    // 終わったイベントは新着にも出さない
    const list = EVENTS.filter(e => !e.date || lastDay(e) >= TODAY).sort((a, b) => b.postedAt.localeCompare(a.postedAt) || b.row - a.row).slice(0, 8);
    $("news").innerHTML = list.map(e => {
      const p = parse(e.posted);
      const isNew = (today - p) / 864e5 <= 7;
      return `<li data-id="${e.id}">
        <span class="title">${esc(e.title)}${isNew ? '<span class="new-badge">NEW</span>' : ""}<br><span class="meta">開催：${whenOf(e)}</span><br><span class="posted">${jp(e.posted)} 掲載</span></span>${tag(e.cat)}</li>`;
    }).join("") || `<li class="empty">まだ掲載情報はありません</li>`;
  }

  let cur = new Date(today.getFullYear(), today.getMonth(), 1);

  const dotsFor = s => {
    const ev = (byDate[s] || []).slice(0, 3).map(e => dot(e.cat)).join("");
    const rg = regOn(parse(s)).length ? '<span class="dot rg"></span>' : "";
    return `<div class="dots">${ev}${rg}</div>`;
  };

  function evRow(e) {
    const past = lastDay(e) < TODAY;
    return `<div class="ev ${e.cat.key === "youth" ? "y" : ""} ${past ? "past" : ""}" data-id="${e.id}">${dateBox(e.date)}<div>
      ${tag(e.cat)}${e.tentative ? ' <span class="tag" style="background:#fff4d6;color:#8a6200">日程予定</span>' : ""}${past ? ' <span class="tag" style="background:#eee;color:#888">終了</span>' : ""}
      <h4>${esc(e.title)}</h4><div class="date-line">${whenOf(e)}</div><div class="meta">${where(e)}</div></div>${e.images.length ? `<img class="thumb" src="${esc(e.images[0].thumb)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>`;
  }
  // 定期活動の行（点線・控えめ）
  const rgRow = (r, label) => `<a class="ev rg" href="regular.html#${r.id}"><div class="rg-when">${esc(label)}</div><div>
      <span class="tag" style="background:${r.cat.bg};color:${r.cat.fg}">${esc(r.cat.label)}</span> <span class="tag rg-tag">定期活動</span>
      <h4>${esc(r.name)}</h4><div class="meta">${esc(window.HC.whenText(r))}${r.place ? "｜" + esc(r.place) : ""}</div></div></a>`;
  const slimRow = e => `<button class="slim ${e.cat.key === "youth" ? "y" : ""}" data-id="${e.id}">
      <span class="s-date">${whenOf(e)}</span>
      <span class="s-main"><span class="s-title">${esc(e.title)}</span>${tag(e.cat)}</span>
      <span class="s-arrow" aria-hidden="true">›</span></button>`;
  const slimRgRow = (r, label) => `<a class="slim rg" href="regular.html#${r.id}">
      <span class="s-date">${esc(label)}</span>
      <span class="s-main"><span class="s-title">${esc(r.name)}</span><span class="tag rg-tag">定期活動</span></span>
      <span class="s-arrow" aria-hidden="true">›</span></a>`;
  function renderList(title, evs, emptyMsg, regs) {
    regs = regs || [];
    // カレンダー下の一覧は細い1行（日付・タイトル・ジャンル）。画像や場所はタップして詳細で見る
    const body = evs.map(slimRow).join("") + regs.map(x => slimRgRow(x.r, x.label)).join("");
    $("listArea").innerHTML = `<p class="list-title">${title}<span class="list-n">${evs.length}件</span></p><div class="slim-list">${body || `<div class="empty">${emptyMsg}</div>`}</div>`;
  }
  // 期間中の定期活動（同じ活動は1回だけ、最初の日を表示）
  function regsBetween(s, e) {
    if (!showRegular) return [];
    const out = [];
    REGULAR.forEach(r => {
      const ds = [];
      for (let d = new Date(s); d <= e; d = addDays(d, 1)) if (window.HC.occursOn(r, d)) ds.push(d);
      if (ds.length) out.push({ r, label: ds.length === 1 ? jp(ds[0]) : `${ds.length}回（${ds.map(d => d.getDate() + "日").join("・")}）` });
    });
    return out;
  }

  function renderMonth() {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1), start = addDays(first, -first.getDay());
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), s = ymd(d);
      if (i >= 35 && d.getMonth() !== m) break;
      const has = !!byDate[s], yy = has && byDate[s].some(e => e.cat.key === "youth");
      const rg = !has && regOn(d).length > 0;
      const hol = holidayName(d);
      const cls = ["cell", d.getMonth() !== m ? "out" : "", has ? "has" : "", rg ? "rgday" : "", yy ? "y" : "", s === TODAY ? "today" : "",
        hol ? "hol" : d.getDay() === 0 ? "sun" : d.getDay() === 6 ? "sat" : ""].join(" ");
      cells += `<div class="${cls}" ${has || rg || hol ? `data-day="${s}"` : ""}${hol ? ` title="${esc(hol)}"` : ""}><span class="num">${d.getDate()}</span>${dotsFor(s)}</div>`;
    }
    const used = [...new Set(dated.map(e => e.cat))];
    $("calCard").innerHTML = `
      <div class="cal-nav"><button class="navbtn" data-nav="-1" aria-label="前の月">‹</button>
        <h3>${y}年 ${m + 1}月</h3><button class="navbtn" data-nav="1" aria-label="次の月">›</button></div>
      <div class="grid">${WD.map((w, i) => `<div class="dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</div>`).join("")}${cells}</div>
      <div class="legend">${used.map(c => `<span>${dot(c)}${esc(c.label)}</span>`).join("")}${showRegular ? '<span><span class="dot rg"></span>定期活動</span>' : ""}<span><span class="hol-mark">祝</span>祝日（下線）</span><span>日付をタップすると、その日のイベントが開きます</span></div>`;

  }

  /* カレンダーの上：今週（月曜〜日曜）のこれからのイベント */
  function renderThisWeek() {
    const s = weekStart(today), e = addDays(s, 6);
    const evs = dated.filter(x => x.date <= ymd(e) && lastDay(x) >= TODAY);
    renderList(`今週のイベント<span class="list-range">${jpRange(ymd(s), ymd(e))}</span>`, evs,
      "今週のイベントはありません。来週以降の予定は下のカレンダーの日付をタップしてください", regsBetween(today, e));
  }

  const renderCal = () => { renderThisWeek(); renderMonth(); };

  function renderTbd() {
    const t = EVENTS.filter(e => !e.date);
    $("tbdSec").classList.toggle("hidden", !t.length);
    $("tbd").innerHTML = t.map(e => `<div data-id="${e.id}">${esc(e.title)}<small>日程調整中</small></div>`).join("");
  }

  /* ---------- 共有 ---------- */
  const SITE_URL = location.origin + location.pathname.replace(/index\.html$/, "");
  const eventUrl = e => `${SITE_URL}?e=${e.id}`;
  const shareText = e => `${e.title}\n${whenOf(e)}${e.date && e.time ? " " + e.time : ""}${e.place ? "\n" + e.place : ""}\n#はまなかイベントカレンダー`;
  let shareTarget = null;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
  }
  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); }
    catch (_) { const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    toast("リンクをコピーしました");
  }
  async function doShare(kind) {
    const e = shareTarget; if (!e) return;
    const url = eventUrl(e);
    if (kind === "native") {
      try { await navigator.share({ title: e.title, text: shareText(e), url }); } catch (_) { /* キャンセル */ }
    } else copyLink(url);
  }

  /* 日付タップ：その日のイベントをふわっと一覧表示 */
  let dayCtx = null;
  function openDay(s) {
    const d = parse(s), evs = byDate[s] || [], regs = regOn(d);
    dayCtx = s;
    $("modal").innerHTML = `<button class="close" aria-label="閉じる">×</button>
      <p class="day-sub">${evs.length + regs.length}件</p><h3>${jp(s)}</h3>${holidayName(d) ? `<p class="hol-name">🎌 ${esc(holidayName(d))}</p>` : ""}
      <div class="list day-list">${evs.map(evRow).join("") + regs.map(r => rgRow(r, "定期")).join("") || '<div class="empty">この日のイベントはありません</div>'}</div>`;
    $("modalBg").classList.add("open");
    $("modal").scrollTop = 0;
  }

  function openModal(id) {
    const e = EVENTS.find(x => x.id === id); if (!e) return;
    const url = safeUrl(e.apply);
    const rows = [
      ["日時", whenOf(e) + (e.date && e.time ? " " + esc(e.time) : "")],
      ["場所", esc(e.place)], ["参加費", esc(e.price)], ["定員", esc(e.capacity)],
      ["参加条件", esc(e.conditions)],
      ["申込締切", e.deadline ? jp(e.deadline) : ""],
      ["申込方法", url ? "" : esc(e.apply)], ["主催", esc(e.organizer)]
    ].filter(r => r[1]);
    $("modal").innerHTML = `<button class="close" aria-label="閉じる">×</button>${dayCtx ? `<button class="back" data-back="${dayCtx}">‹ ${jp(dayCtx)}の一覧へ</button><br>` : ""}${tag(e.cat)}
      <h3>${esc(e.title)}</h3>
      ${e.images.length ? `<div class="pics">${e.images.map(im => `<img src="${esc(im.full)}" alt="${esc(e.title)}のチラシ・画像" loading="lazy" onerror="this.remove()">`).join("")}</div>` : ""}
      <p>${esc(e.desc)}</p>
      <dl>${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("")}</dl>
      ${url ? `<a class="cta" href="${esc(url)}" target="_blank" rel="noopener">申し込み・詳細はこちら</a>` : ""}
      ${e.tentative ? '<div class="note">日程は予定です。変更になる場合があります。</div>' : ""}
      <div class="share">
        <p class="share-ttl">このイベントを共有する</p>
        <div class="share-btns">
          <button class="sbtn native hidden" data-share="native">共有する</button>
          <a class="sbtn line" href="https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(eventUrl(e))}" target="_blank" rel="noopener">LINEで送る</a>
          <a class="sbtn x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(e))}&url=${encodeURIComponent(eventUrl(e))}" target="_blank" rel="noopener">Xでポスト</a>
          <a class="sbtn fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl(e))}" target="_blank" rel="noopener">Facebook</a>
          <button class="sbtn copy" data-share="copy">リンクをコピー</button>
        </div>
      </div>`;
    shareTarget = e;
    if (navigator.share) $("modal").querySelector(".native").classList.remove("hidden");
    $("modalBg").classList.add("open");
    $("modal").scrollTop = 0;
  }

  /* ---------- イベント操作 ---------- */
  $("calCard").addEventListener("click", ev => {
    const nav = ev.target.closest("[data-nav]");
    if (nav) { cur = new Date(cur.getFullYear(), cur.getMonth() + Number(nav.dataset.nav), 1); return renderMonth(); }
    const c = ev.target.closest("[data-day]"); if (c) openDay(c.dataset.day);
  });
  /* 画像タップでサイト内に拡大表示（もう一度タップで閉じる） */
  const zoom = document.createElement("div");
  zoom.className = "zoom";
  document.body.appendChild(zoom);
  $("modal").addEventListener("click", ev => {
    const sh = ev.target.closest("[data-share]"); if (sh) { ev.stopPropagation(); return doShare(sh.dataset.share); }
    // 中身を書き換えるので、ページ全体のクリック処理には伝えない
    const back = ev.target.closest("[data-back]"); if (back) { ev.stopPropagation(); return openDay(back.dataset.back); }
    const row = ev.target.closest("[data-id]"); if (row) { ev.stopPropagation(); return openModal(row.dataset.id); }
    const img = ev.target.closest(".pics img"); if (!img) return;
    zoom.innerHTML = `<img src="${esc(img.src)}" alt="${esc(img.alt)}"><button class="close" aria-label="閉じる">×</button>`;
    zoom.classList.add("open");
  });
  zoom.addEventListener("click", () => zoom.classList.remove("open"));
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") zoom.classList.remove("open"); });
  const closeModal = () => {
    $("modalBg").classList.remove("open");
    if (location.search.includes("e=")) history.replaceState(null, "", location.pathname + location.hash);
  };
  $("modalBg").addEventListener("click", ev => { if (ev.target === $("modalBg") || ev.target.closest(".close")) closeModal(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeModal(); });
  document.body.addEventListener("click", ev => {
    if (ev.target.closest(".modal")) return;
    const t = ev.target.closest("[data-id]"); if (t) { dayCtx = null; openModal(t.dataset.id); }
  });

  /* ---------- 定期活動・サークル ---------- */
  $("regToggle").addEventListener("click", () => {
    showRegular = !showRegular;
    $("regToggle").setAttribute("aria-pressed", String(showRegular));
    renderCal();
  });

  function renderRegularBand() {
    const pick = window.HC.pickForTop(REGULAR, 4), t1 = addDays(today, 1);
    $("regCount").textContent = REGULAR.length;
    $("regBand").innerHTML = pick.length ? pick.map(r => {
      const badge = window.HC.occursOn(r, today) ? '<span class="count">今日あり</span>' : window.HC.occursOn(r, t1) ? '<span class="count">明日あり</span>' : "";
      return `<a class="rcard" href="regular.html#${r.id}">
        <div><span class="tag" style="background:${r.cat.bg};color:${r.cat.fg}">${esc(r.cat.label)}</span>${r.visit ? ' <span class="tag visit">見学OK</span>' : ""} ${badge}</div>
        <h3>${esc(r.name)}</h3>
        <div class="meta"><b>${esc(window.HC.whenText(r))}</b><br>${esc(r.place)}</div>
        ${r.checked ? `<div class="checked">最終確認：${jp(r.checked)}</div>` : ""}</a>`;
    }).join("") : `<div class="empty">定期活動・サークルの情報は準備中です</div>`;
  }

  /* ---------- 起動 ---------- */
  $("todayPill").textContent = `今日は ${jp(TODAY)}`;
  $("operator").textContent = CFG.OPERATOR || "";
  if (safeUrl(CFG.FORM_URL)) {
    ["postBtnTop", "postBtn"].forEach(id => $(id).href = CFG.FORM_URL);
    $("postBtnTop").classList.remove("hidden");
  }
  if (safeUrl(CFG.REGULAR_FORM_URL)) $("postRegBtn").href = CFG.REGULAR_FORM_URL;
  else { $("postRegBtn").classList.add("soon"); $("postRegBtn").textContent = "サークルを掲載（準備中）"; $("postRegBtn").removeAttribute("href"); }

  window.HC.loadRegular().then(list => { REGULAR = list; renderRegularBand(); if (EVENTS.length) renderCal(); })
    .catch(err => { console.error(err); renderRegularBand(); });

  loadEvents().then(list => {
    EVENTS = list;
    dated = EVENTS.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
    byDate = {};
    dated.forEach(e => {
      for (let d = parse(e.date), n = 0; ymd(d) <= lastDay(e) && n < 92; d = addDays(d, 1), n++) (byDate[ymd(d)] = byDate[ymd(d)] || []).push(e);
    });
    $("loading").remove();
    renderYouth(); renderNews(); renderCal(); renderTbd();
    // 共有リンク（?e=xxxx）から来たら、そのイベントの詳細を開く
    const shared = new URLSearchParams(location.search).get("e");
    if (shared) {
      if (EVENTS.some(e => e.id === shared)) openModal(shared);
      else toast("このイベントは見つかりませんでした（終了または掲載終了の可能性があります）");
    }
  }).catch(err => {
    $("loading").textContent = "イベント情報を読み込めませんでした。時間をおいて再度お試しください。";
    console.error(err);
  });
})();
