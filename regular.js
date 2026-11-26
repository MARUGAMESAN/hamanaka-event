/* 定期活動・サークルの一覧ページ */
(function () {
  "use strict";
  const H = window.HC, $ = id => document.getElementById(id);
  const f = { cat: "", day: -1, target: "" };
  let LIST = [];

  // 「高校生以上・初心者歓迎」→ ["高校生以上", "初心者歓迎"]
  const targets = r => String(r.target || "").split(/[・、,，\/／\s]+/).map(s => s.trim()).filter(Boolean);

  function chips(el, items, isOn, onPick) {
    el.querySelectorAll(".chip").forEach(c => c.remove());
    items.forEach(it => {
      const b = document.createElement("button");
      b.className = "chip" + (isOn(it.v) ? " on" : "");
      b.textContent = it.label;
      b.setAttribute("aria-pressed", String(isOn(it.v)));
      b.addEventListener("click", () => { onPick(it.v); render(); });
      el.appendChild(b);
    });
  }

  function card(r) {
    const c = H.contactLink(r.contact);
    const rows = [["いつ", `<b>${H.esc(H.whenText(r))}</b>`], ["どこ", H.esc(r.place)], ["対象", H.esc(r.target)], ["参加費", H.esc(r.price)],
      ["問合せ", c ? "" : H.esc(r.contact)]].filter(x => x[1]);
    return `<article class="rgcard" id="${r.id}">
      <div><span class="tag" style="background:${r.cat.bg};color:${r.cat.fg}">${H.esc(r.cat.label)}</span>${r.visit ? ' <span class="tag visit">見学OK</span>' : ""}</div>
      <h3>${H.esc(r.name)}</h3>
      ${r.desc ? `<p class="desc">${H.esc(r.desc)}</p>` : ""}
      <dl>${rows.map(x => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join("")}</dl>
      <div class="foot"><span class="checked">最終確認：${r.checked ? H.jp(r.checked) : "—"}</span>
        ${c ? `<a class="cta" href="${H.esc(c.href)}"${c.ext ? ' target="_blank" rel="noopener"' : ""}>${c.label}</a>` : ""}</div>
    </article>`;
  }

  function render() {
    const cats = [...new Set(Object.keys(H.RCATS).filter(k => k !== "その他").concat(LIST.map(r => r.cat.label)))];
    chips($("fCat"), [{ v: "", label: "すべて" }].concat(cats.map(c => ({ v: c, label: c }))), v => v === f.cat, v => f.cat = v);
    chips($("fDay"), [{ v: -1, label: "すべて" }].concat([1, 2, 3, 4, 5, 6, 0].map(i => ({ v: i, label: H.WD[i] }))), v => v === f.day, v => f.day = v);

    const shown = LIST.filter(r => (!f.cat || r.cat.label === f.cat) && (f.day < 0 || r.days.includes(f.day)) && (!f.target || targets(r).includes(f.target) || /どなたでも|誰でも|だれでも/.test(r.target)));
    $("rcount").textContent = LIST.length ? `${shown.length}件の活動（全${LIST.length}件）` : "";
    $("rgrid").innerHTML = shown.length ? shown.map(card).join("")
      : `<div class="empty">${LIST.length ? "条件に合う活動はありません。絞り込みを変えてみてください。" : "定期活動・サークルの情報は準備中です。"}</div>`;
  }

  $("fTarget").addEventListener("change", e => { f.target = e.target.value; render(); });
  $("operator").textContent = H.CFG.OPERATOR || "";
  if (H.safeUrl(H.CFG.FORM_URL)) $("postBtn").href = H.CFG.FORM_URL; else $("postBtn").classList.add("hidden");
  if (H.safeUrl(H.CFG.REGULAR_FORM_URL)) $("postRegBtn").href = H.CFG.REGULAR_FORM_URL;
  else { $("postRegBtn").classList.add("soon"); $("postRegBtn").textContent = "サークルを掲載（準備中）"; $("postRegBtn").removeAttribute("href"); }

  H.loadRegular().then(list => {
    // 最近確認したものから順に
    LIST = list.sort((a, b) => (b.checked || "").localeCompare(a.checked || ""));
    const ts = [...new Set(LIST.flatMap(targets))];
    $("fTarget").insertAdjacentHTML("beforeend", ts.map(t => `<option>${H.esc(t)}</option>`).join(""));
    render();
    if (location.hash && $(location.hash.slice(1))) $(location.hash.slice(1)).scrollIntoView();
  }).catch(err => { $("rcount").textContent = "読み込めませんでした。時間をおいて再度お試しください。"; console.error(err); });
})();
