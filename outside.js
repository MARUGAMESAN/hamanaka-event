/* 町外イベント（道東・道内の大きなイベント）の一覧ページ */
(function () {
  "use strict";
  const H = window.HC, $ = id => document.getElementById(id);
  let LIST = [], area = "";

  function card(o) {
    const when = o.date && o.last >= H.TODAY
      ? `<span class="o-when fixed">${H.esc(H.jpRange(o.date, o.end))}</span>`
      : `<span class="o-when">例年 ${H.esc(o.season || "—")}</span>`;
    const rows = [["会場", H.esc([o.town, o.place].filter(Boolean).join("　"))], ["浜中から", o.access ? "車で" + H.esc(o.access) : ""]].filter(x => x[1]);
    return `<article class="rgcard ocard-l" id="${o.id}">
      <div>${when}</div>
      <h3>${H.esc(o.name)}${o.big ? ' <span class="o-big">大型</span>' : ""}</h3>
      <div class="o-tags"><span class="tag">${H.esc(o.area)}</span>${o.genre ? `<span class="tag g">${H.esc(o.genre)}</span>` : ""}</div>
      ${o.note ? `<p class="desc">${H.esc(o.note)}</p>` : ""}
      <dl>${rows.map(x => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join("")}</dl>
      <div class="foot"><span class="checked">最終確認：${o.checked ? H.jp(o.checked) : "—"}</span>
        ${o.url ? `<a class="cta" href="${H.esc(o.url)}" target="_blank" rel="noopener">公式・詳しい情報</a>` : ""}</div>
    </article>`;
  }

  function render() {
    const el = $("fArea");
    el.querySelectorAll(".chip").forEach(c => c.remove());
    [{ v: "", label: "すべて" }].concat(H.OAREAS).forEach(a => {
      const b = document.createElement("button");
      b.className = "chip" + (a.v === area ? " on" : "");
      b.textContent = a.label;
      b.setAttribute("aria-pressed", String(a.v === area));
      b.addEventListener("click", () => { area = a.v; render(); });
      el.appendChild(b);
    });

    const test = (H.OAREAS.find(a => a.v === area) || { test: () => true }).test;
    const shown = LIST.filter(test);
    $("ocount").textContent = LIST.length ? `${shown.length}件（全${LIST.length}件）` : "";

    // ① 日程が決まっているもの（近い順）
    const fixed = shown.filter(H.outsideUpcoming).sort((a, b) => a.date.localeCompare(b.date));
    $("oFixed").innerHTML = fixed.length
      ? `<h2 class="o-head">日程が決まっているもの</h2><div class="rgrid">${fixed.map(card).join("")}</div>` : "";

    // ② それ以外：例年の時期ごと（今月から1年分）
    const rest = shown.filter(o => !H.outsideUpcoming(o));
    const groups = {};
    rest.forEach(o => { (groups[o.month] = groups[o.month] || []).push(o); });
    const months = Object.keys(groups).map(Number).sort((a, b) => H.monthsFromNow(a) - H.monthsFromNow(b));
    $("oMonths").innerHTML = months.map(m => `<h2 class="o-head">${m ? `例年 ${m}月ごろ` : "時期未定"}${m && H.monthsFromNow(m) === 0 ? '<span class="o-now">今月</span>' : ""}</h2>
      <div class="rgrid">${groups[m].sort((a, b) => (b.big - a.big)).map(card).join("")}</div>`).join("")
      || (fixed.length ? "" : `<div class="empty">${LIST.length ? "この地域のイベントはまだありません。" : "町外イベントの情報は準備中です。"}</div>`);
  }

  $("operator").textContent = H.CFG.OPERATOR || "";
  H.loadOutside().then(list => {
    LIST = list;
    render();
    if (location.hash && $(location.hash.slice(1))) $(location.hash.slice(1)).scrollIntoView();
  }).catch(err => { $("ocount").textContent = "読み込めませんでした。時間をおいて再度お試しください。"; console.error(err); });
})();
