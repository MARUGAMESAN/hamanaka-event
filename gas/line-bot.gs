/**
 * はまなかイベントカレンダー：公式LINEの自動返信
 *
 * 友だちから「今週」「今日」「サークル」などと送られてきたら、
 * スプレッドシートの「公開用」「定期活動_公開用」タブを読んで、その場で返信します。
 * 返信（応答）メッセージなので、無料プランの月の上限には数えられません。
 *
 * 使い方（くわしい手順は「公式LINE設定手順.md」）
 *  1. 回答スプレッドシートの「拡張機能 > Apps Script」で、ファイルを1つ追加（＋ > スクリプト）し、
 *     名前を「line-bot」にして、このファイルの中身をすべて貼り付けて保存
 *  2. 「プロジェクトの設定 > スクリプト プロパティ」に
 *     プロパティ名 LINE_TOKEN ／ 値 チャネルアクセストークン（長期）を追加
 *     ※ トークンはここにだけ書く。このファイルや GitHub には絶対に書かない
 *  3. 関数「lineTest」を実行して、ログに返信の文面が出ることを確認（初回は権限の許可）
 *  4. 「デプロイ > 新しいデプロイ > ウェブアプリ」
 *     次のユーザーとして実行：自分 ／ アクセスできるユーザー：全員 → デプロイ
 *  5. 出てきたウェブアプリのURLを、LINE Developers の Messaging API 設定の Webhook URL に貼り、
 *     「Webhookの利用」をオンにする
 *  ※ このファイルを直したあとは「デプロイを管理 > 編集（鉛筆）> バージョン：新バージョン > デプロイ」で反映
 */

const LINE_SITE = "https://marugamesan.github.io/hamanaka-event/";
const LINE_REGULAR_PAGE = LINE_SITE + "regular.html";
const LINE_EVENT_FORM = "https://forms.gle/W5fUZy2moYaimNNK6";
const LINE_CIRCLE_FORM = "https://forms.gle/qxWPcJKKXZq7FkZu5";
const LINE_CONTACT_FORM = "https://forms.gle/BH6mjGzeyhJpRUx88";
const LINE_EVENT_SHEET = "公開用";
const LINE_REGULAR_SHEET = "定期活動_公開用";
const LINE_TZ = "Asia/Tokyo";
const LINE_WD = ["日", "月", "火", "水", "木", "金", "土"];
const LINE_MAX_EVENTS = 10;   // 1回の返信に載せるイベントの数
const LINE_MAX_CIRCLES = 15;  // 1回の返信に載せるサークルの数

// 返信の下に出る「すぐ押せるボタン」（押すとその言葉を送ったことになる）
const LINE_QUICK = ["今日", "明日", "今週", "来週", "週末", "サークル", "掲載したい"];

/* ---------- LINEからの受け口 ---------- */
function doPost(e) {
  // エディタから直接「実行」したとき（LINEからの呼び出しではない）は何もしない
  if (!e || !e.postData) {
    console.log("doPost は LINE から呼ばれる関数です。動作確認は lineTest を実行してください。");
    return ContentService.createTextOutput("OK");
  }
  try {
    const body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(ev => {
      if (!ev.replyToken || ev.type !== "message" || !ev.message || ev.message.type !== "text") return;
      const userId = ev.source && ev.source.userId;
      const text = lineAnswer_(ev.message.text, userId);
      if (text) lineReply_(ev.replyToken, text);
    });
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput("OK");
}

// ブラウザでウェブアプリのURLを開いたとき用（動いているかの確認）
function doGet() {
  return ContentService.createTextOutput("はまなかイベントカレンダー LINE自動返信：動いています");
}

/* ---------- 言葉ごとの返事 ---------- */
function lineAnswer_(raw, userId) {
  const s = String(raw || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  const today = lineToday_();

  if (/問い合わせ|問合せ|お問合せ|修正|取り消し|取消|不具合|間違/.test(s)) return lineContactText_();
  if (/掲載|載せ|のせ|申請|申し込み|登録したい/.test(s)) return lineFormsText_();
  if (/ヘルプ|使い方|つかいかた|メニュー|help/.test(s)) return lineHelpText_();
  if (/今日|きょう|本日/.test(s)) return lineDayText_(today, "今日");
  if (/明日|あした|あす/.test(s)) return lineDayText_(lineAddDays_(today, 1), "明日");
  if (/来週|らいしゅう/.test(s)) {
    const mon = lineAddDays_(lineMonday_(today), 7);
    return lineRangeText_(mon, lineAddDays_(mon, 6), "来週のイベント");
  }
  if (/週末|土日|しゅうまつ/.test(s)) {
    const mon = lineMonday_(today);
    const sat = lineAddDays_(mon, 5);
    return lineRangeText_(sat < today ? today : sat, lineAddDays_(mon, 6), "今週末のイベント");
  }
  if (/今週|こんしゅう|イベント|いべんと|カレンダー|予定/.test(s)) {
    const mon = lineMonday_(today);
    return lineRangeText_(mon, lineAddDays_(mon, 6), "今週のイベント");
  }
  if (/サークル|定期|習い事|ならいごと|教室|クラブ/.test(s)) return lineCirclesText_();
  const wd = s.match(/^([日月火水木金土])(曜日?|曜)?$/);
  if (wd) return lineWeekdayCirclesText_(LINE_WD.indexOf(wd[1]));

  // それ以外：運営者が手で返事をすることもあるので、使い方の案内は6時間に1回だけ
  if (userId) {
    const cache = CacheService.getScriptCache();
    const key = "hint_" + userId;
    if (cache.get(key)) return null;
    cache.put(key, "1", 6 * 60 * 60);
  }
  return "メッセージありがとうございます。\n\n" + lineHelpText_();
}

function lineHelpText_() {
  return [
    "📅 はまなかイベントカレンダー",
    "",
    "下のボタンを押すか、次の言葉を送ってください。",
    "・今日／明日",
    "・今週／来週／週末",
    "・サークル（定期活動の一覧）",
    "・火曜 など（その曜日のサークル）",
    "・掲載したい（申請フォーム）",
    "・問い合わせ（修正・取り消し・ご意見）",
    "",
    "サイトはこちら👇",
    LINE_SITE
  ].join("\n");
}

function lineContactText_() {
  return [
    "✉️ お問い合わせ",
    "",
    "掲載内容の修正・取り消し、間違いのお知らせ、ご意見はこちらのフォームからどうぞ。",
    LINE_CONTACT_FORM,
    "",
    "このトークに書いていただいても大丈夫です。"
  ].join("\n");
}

function lineFormsText_() {
  return [
    "📝 掲載のお申し込み（無料）",
    "",
    "▼ イベントを掲載する",
    LINE_EVENT_FORM,
    "",
    "▼ サークル・定期活動を掲載する",
    LINE_CIRCLE_FORM,
    "",
    "内容を確認してから掲載します。"
  ].join("\n");
}

// 期間のイベント
function lineRangeText_(from, to, title) {
  const today = lineToday_();
  const s = lineYmd_(from < today ? today : from), e = lineYmd_(to);
  const list = lineEvents_().filter(ev => ev.date && ev.date <= e && (ev.end || ev.date) >= s);
  const head = `📅 ${title}\n${lineMd_(from)}〜${lineMd_(to)}`;
  if (!list.length) {
    return `${head}\n\n今のところ掲載されているイベントはありません。\n\nカレンダーで先の予定も見られます👇\n${LINE_SITE}`;
  }
  return [head, "", lineEventLines_(list), "", "カレンダーはこちら👇", LINE_SITE].join("\n");
}

// 1日分：イベント＋その日の定期活動
function lineDayText_(d, label) {
  const k = lineYmd_(d);
  const events = lineEvents_().filter(ev => ev.date && ev.date <= k && (ev.end || ev.date) >= k);
  const regs = lineRegulars_().filter(r => lineOccursOn_(r, d));
  const out = [`📅 ${label} ${lineMd_(d)} の予定`, ""];
  if (events.length) out.push(lineEventLines_(events));
  else out.push("掲載されているイベントはありません。");
  if (regs.length) {
    out.push("", "🔁 定期活動・サークル");
    regs.slice(0, LINE_MAX_CIRCLES).forEach(r => out.push(`・${r.name}${r.time ? "　" + r.time : ""}${r.place ? "\n　📍" + r.place : ""}`));
  }
  out.push("", "カレンダーはこちら👇", LINE_SITE);
  return out.join("\n");
}

function lineEventLines_(list) {
  const lines = list.slice(0, LINE_MAX_EVENTS).map(ev => {
    const when = (ev.end && ev.end !== ev.date ? `${lineMd_(ev.date)}〜${lineMd_(ev.end)}` : lineMd_(ev.date)) + (ev.time ? " " + ev.time : "");
    return [
      `■ ${when}${ev.tentative ? "（予定）" : ""}`,
      ev.title,
      ev.place ? "📍" + ev.place : "",
      LINE_SITE + "?e=" + ev.id
    ].filter(Boolean).join("\n");
  });
  if (list.length > LINE_MAX_EVENTS) lines.push(`ほかに${list.length - LINE_MAX_EVENTS}件あります（サイトで見られます）`);
  return lines.join("\n\n");
}

function lineCirclesText_() {
  const list = lineRegulars_();
  if (!list.length) return `🔁 定期活動・サークル\n\n今のところ掲載はありません。\n\n掲載のお申し込みはこちら👇\n${LINE_CIRCLE_FORM}`;
  const lines = list.slice(0, LINE_MAX_CIRCLES).map(r => `■ ${r.name}\n${lineWhen_(r)}${r.place ? "\n📍" + r.place : ""}`);
  if (list.length > LINE_MAX_CIRCLES) lines.push(`ほかに${list.length - LINE_MAX_CIRCLES}件あります`);
  return ["🔁 定期活動・サークル", "", lines.join("\n\n"), "", "くわしい内容・問い合わせ先はこちら👇", LINE_REGULAR_PAGE].join("\n");
}

function lineWeekdayCirclesText_(w) {
  const list = lineRegulars_().filter(r => r.days.indexOf(w) >= 0);
  const head = `🔁 ${LINE_WD[w]}曜日の定期活動・サークル`;
  if (!list.length) return `${head}\n\n${LINE_WD[w]}曜日の活動は、今のところ掲載がありません。\n\n一覧はこちら👇\n${LINE_REGULAR_PAGE}`;
  const lines = list.slice(0, LINE_MAX_CIRCLES).map(r => `■ ${r.name}\n${lineWhen_(r)}${r.place ? "\n📍" + r.place : ""}`);
  return [head, "", lines.join("\n\n"), "", "くわしくはこちら👇", LINE_REGULAR_PAGE].join("\n");
}

/* ---------- シートの読み込み ---------- */
function lineRows_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  const head = (v.shift() || []).map(h => String(h).trim());
  return v.map(r => { const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i]; }); return o; });
}

// サイト（app.js）と同じやり方でイベントIDを作る → 共有URL ?e=ID でそのイベントが開く
function lineHashId_(str) {
  let h = 5381;
  for (const ch of str) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return "e" + h.toString(36);
}

function lineEvents_() {
  const used = {};
  return lineRows_(LINE_EVENT_SHEET)
    .filter(r => String(r.title || "").trim())
    .map(r => {
      const posted = lineDate_(r.posted);
      let id = lineHashId_(String(r.title).trim() + "|" + posted);
      while (used[id]) id += "x";
      used[id] = 1;
      return {
        id: id,
        title: String(r.title).trim(),
        date: lineDate_(r.date),
        end: lineDate_(r.end),
        time: lineTime_(r.time),
        place: String(r.place || "").trim(),
        tentative: /^(true|1|yes|はい|ok|○|◯|可)$/i.test(String(r.tentative || "").trim())
      };
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.time.localeCompare(b.time));
}

function lineRegulars_() {
  return lineRows_(LINE_REGULAR_SHEET)
    .filter(r => String(r.name || "").trim())
    .map(r => {
      const daysText = String(r.weekdays || ""), freqText = String(r.frequency || "");
      return {
        name: String(r.name).trim(),
        daysText: daysText, freqText: freqText,
        time: String(r.time || "").replace(/^〜$/, "").trim(),
        place: String(r.place || "").trim(),
        days: lineParseDays_(daysText),
        freq: lineParseFreq_(freqText)
      };
    });
}

/* ---------- 定期活動の曜日・頻度（サイトの common.js と同じ考え方） ---------- */
function lineParseDays_(v) {
  const s = String(v || "").normalize("NFKC").replace(/\s+/g, "");
  if (/毎日/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  const out = [];
  LINE_WD.forEach((w, i) => { if (s.indexOf(w) >= 0) out.push(i); });
  if (/平日/.test(s)) [1, 2, 3, 4, 5].forEach(i => { if (out.indexOf(i) < 0) out.push(i); });
  return out.sort();
}
function lineParseFreq_(v) {
  const s = String(v || "").normalize("NFKC").replace(/\s+/g, "");
  if (!s || /毎週|毎日/.test(s)) return { weekly: true, nth: [] };
  const nth = [];
  if (s.indexOf("第") >= 0) (s.slice(s.indexOf("第")).match(/\d/g) || []).map(Number).filter(n => n >= 1 && n <= 5).forEach(n => nth.push(n));
  if (/最終/.test(s)) nth.push(-1);
  return { weekly: false, nth: nth };
}
function lineOccursOn_(r, d) {
  if (r.days.indexOf(d.getDay()) < 0) return false;
  if (r.freq.weekly) return true;
  const n = Math.ceil(d.getDate() / 7);
  const last = lineAddDays_(d, 7).getMonth() !== d.getMonth();
  return r.freq.nth.indexOf(n) >= 0 || (last && r.freq.nth.indexOf(-1) >= 0);
}
function lineWhen_(r) {
  const days = r.days.length ? r.days.map(i => LINE_WD[i]).join("・") + "曜" : r.daysText;
  return [r.freqText || "毎週", days, r.time].filter(Boolean).join(" ");
}

/* ---------- 日付まわり ---------- */
function lineToday_() {
  const [y, m, d] = Utilities.formatDate(new Date(), LINE_TZ, "yyyy-MM-dd").split("-").map(Number);
  return new Date(y, m - 1, d);
}
function lineAddDays_(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function lineMonday_(d) { return lineAddDays_(d, -((d.getDay() + 6) % 7)); }
const linePad_ = n => String(n).padStart(2, "0");
function lineYmd_(d) { return `${d.getFullYear()}-${linePad_(d.getMonth() + 1)}-${linePad_(d.getDate())}`; }
function lineMd_(v) {
  const d = typeof v === "string" ? new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) : v;
  return `${d.getMonth() + 1}/${d.getDate()}（${LINE_WD[d.getDay()]}）`;
}
// シートの日付（Date か "2026/11/28" のような文字）→ "2026-11-28"
function lineDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, LINE_TZ, "yyyy-MM-dd");
  const m = String(v || "").match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  return m ? `${m[1]}-${linePad_(m[2])}-${linePad_(m[3])}` : "";
}
// 時刻のセル（Date になっていることがある）→ "14:30"
function lineTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, LINE_TZ, "H:mm");
  return String(v || "").trim();
}

/* ---------- 返信を送る ---------- */
function lineReply_(replyToken, text) {
  const token = PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");
  if (!token) { console.error("スクリプト プロパティ LINE_TOKEN が未設定です"); return; }
  const msg = {
    type: "text",
    text: text.slice(0, 4900),
    quickReply: { items: LINE_QUICK.map(w => ({ type: "action", action: { type: "message", label: w, text: w } })) }
  };
  const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [msg] }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) console.error("LINE返信エラー " + res.getResponseCode() + " " + res.getContentText());
}

/* ---------- 動作確認（実行するとログに返信の文面が出る。LINEには送らない） ---------- */
function lineTest() {
  ["今日", "明日", "今週", "来週", "週末", "サークル", "火曜", "掲載したい", "こんにちは"].forEach(w => {
    console.log("▼「" + w + "」と送られたとき\n" + lineAnswer_(w, null));
  });
}
