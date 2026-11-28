/**
 * はまなかイベントカレンダー：作成済みの「イベント掲載申請フォーム」とサイトをつなぐスクリプト
 *
 * 使い方
 *  1. Googleフォームの編集画面 →「回答」タブ →「スプレッドシートにリンク」で回答用スプレッドシートを作る
 *  2. そのスプレッドシートを開き、メニュー「拡張機能 > Apps Script」を開く
 *  3. このファイルの中身をすべて貼り付けて保存
 *  4. 関数「setup」を選んで「実行」（初回は権限の許可を求められます）
 *  5. スプレッドシートの「公開用」タブを「ファイル > 共有 > ウェブに公開」で CSV 公開し、
 *     出てきたURLをサイトの config.js の SHEET_CSV_URL に貼る
 *
 * できること
 *  - 回答シートの右端に「掲載」「日程予定（未確定）」「管理メモ」列を追加（掲載にチェックしたものだけサイトに出る）
 *  - 「公開用」タブを作り、掲載チェック済みの行だけをサイト用の並びで自動表示
 *  - 既存の5イベントを初期データとして回答シートに入れる（1回だけ）
 *  - 申請が届いたら管理者（このスクリプトを実行した人）にメール通知
 *
 * フォームの質問を追加・名前変更したとき
 *  - 関数「rebuildPublicTab」を実行し直せば、「公開用」タブの並びが作り直されます
 *  - 質問名は下の FIELDS の候補名のどれかにしておくとサイトに反映されます
 *    （例：「時間」「定員」「申込締切」を足すと、サイトにも表示されるようになる）
 */

// 申請通知メールを追加で送るアドレス（スクリプトを実行した人には常に届く）
// 例： const NOTIFY_TO = ["aaa@example.com", "bbb@example.com"];
const NOTIFY_TO = [];

const SITE_NAME = "はまなかイベントカレンダー";
const PUB_SHEET = "公開用";
const ADMIN_COLS = ["掲載", "日程予定（未確定）", "管理メモ"];

// サイトの項目名 ← フォームの質問名の候補（上から順に探す）
const FIELDS = [
  ["posted",      ["タイムスタンプ", "Timestamp"]],
  ["title",       ["イベント名"]],
  ["date",        ["日時", "開催日", "日付"]],
  ["time",        ["時間", "開催時間"]],
  ["place",       ["場所", "会場"]],
  ["category",    ["カテゴリ", "カテゴリー"]],
  ["price",       ["参加費"]],
  ["capacity",    ["定員"]],
  ["deadline",    ["申込締切", "申し込み締切", "締切", "申込期限", "申し込み期限"]],
  ["apply",       ["申込方法", "申込方法・URL", "申し込み方法"]],
  ["description", ["説明文", "イベント内容"]],
  ["organizer",   ["主催者名", "主催者名（サイトに掲載）"]],
  ["tentative",   ["日程予定（未確定）"]],
  ["conditions",  ["参加条件", "参加資格", "対象"]],
  ["image1",      ["イベントチラシ等の掲載", "イベントチラシ等の掲載（1枚目）", "画像1", "画像（1枚目）"]],
  ["image2",      ["イベントチラシ等の掲載（2枚目）", "画像2", "画像（2枚目）"]],
  ["end",         ["開催日(2日以上ある場合は終了日を記載)", "終了日", "最終日"]]
];
const DATE_FIELDS = ["posted", "date", "deadline", "end"];

/* ===================================================== */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resp = findResponseSheet_(ss);
  addAdminColumns_(resp);
  addInitialEvents_(resp);
  rebuildPublicTab();

  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "notifyNewSubmission");
  if (!has) ScriptApp.newTrigger("notifyNewSubmission").forSpreadsheet(ss).onFormSubmit().create();

  Logger.log("✅ セットアップ完了");
  Logger.log("次は「公開用」タブを「ファイル > 共有 > ウェブに公開」で CSV 公開し、URLを config.js の SHEET_CSV_URL に貼ってください。");
}

/** 「公開用」タブを作り直す（フォームの質問を変えたらこれを実行） */
function rebuildPublicTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resp = findResponseSheet_(ss);
  const heads = headers_(resp);
  const pubCol = colOf_(heads, ["掲載"]);
  if (!pubCol) throw new Error("「掲載」列がありません。先に setup を実行してください。");

  // 列全体（A:A）で参照する。フォームの回答で行が挿入されても範囲がずれない。
  // 見出し行は「掲載」の値が TRUE にならないので自動的に除外される。
  const ref = "'" + resp.getName().replace(/'/g, "''") + "'!";
  const rng = c => ref + letter_(c) + ":" + letter_(c);
  const missing = [];
  const cols = FIELDS.map(([key, names]) => {
    const c = colOf_(heads, names);
    if (!c) { missing.push(key + "（" + names[0] + "）"); return "IF(ROW(" + ref + "A:A),\"\")"; }
    return rng(c);
  });
  // チェックボックス（TRUE）でも、手入力の「TRUE」でも掲載扱いにする
  const formula = "=ARRAYFORMULA(IFERROR(FILTER({" + cols.join(",") + "},UPPER(" + rng(pubCol) + "&\"\")=\"TRUE\"),\"\"))";

  const pub = ss.getSheetByName(PUB_SHEET) || ss.insertSheet(PUB_SHEET);
  pub.clear();
  pub.getRange(1, 1, 1, FIELDS.length).setValues([FIELDS.map(f => f[0])])
    .setFontWeight("bold").setBackground("#eef3f6");
  pub.getRange("A2").setFormula(formula);
  DATE_FIELDS.forEach(k => {
    const i = FIELDS.findIndex(f => f[0] === k) + 1;
    pub.getRange(2, i, pub.getMaxRows() - 1, 1).setNumberFormat("yyyy-mm-dd");
  });
  // 「開催時間」が時刻形式の質問でも「18:30」と表示されるように
  pub.getRange(2, FIELDS.findIndex(f => f[0] === "time") + 1, pub.getMaxRows() - 1, 1).setNumberFormat("H:mm");
  pub.setFrozenRows(1);
  pub.setTabColor("#1aa38a");
  pub.getRange(1, FIELDS.length + 2).setValue(
    "← このタブは自動で作られます。直接編集しないでください。このタブだけを「ウェブに公開（CSV）」します。"
  ).setFontColor("#888888");

  if (missing.length) Logger.log("フォームに無い項目（サイトでは空欄表示）: " + missing.join("、"));
  Logger.log("「公開用」タブを作り直しました。");
}

/** 申請が届いたら管理者にメール */
function notifyNewSubmission(e) {
  // 新しい申請の行に「掲載」「日程予定」のチェックボックスを付ける
  try {
    const sh = e.range.getSheet();
    const heads = headers_(sh);
    const cb = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    ["掲載", "日程予定（未確定）"].forEach(n => {
      const c = colOf_(heads, [n]);
      if (c) sh.getRange(e.range.getRow(), c).setDataValidation(cb);
    });
  } catch (err) { Logger.log(err); }

  // アップロードされた画像を「リンクを知っている全員が閲覧可」にする（サイトに表示するため）
  try { shareImagesInRow_(e.range.getSheet(), e.range.getRow()); } catch (err) { Logger.log(err); }

  const nv = (e && e.namedValues) || {};
  const title = (nv["イベント名"] || [""])[0];
  const lines = Object.keys(nv)
    .filter(k => k && ADMIN_COLS.indexOf(k) < 0)
    .map(k => "■ " + k + "\n" + nv[k].join(", "));
  const to = [Session.getEffectiveUser().getEmail()].concat(NOTIFY_TO)
    .map(s => String(s).trim()).filter(Boolean).join(",");
  MailApp.sendEmail(
    to,
    "【" + SITE_NAME + "】掲載申請が届きました：" + title,
    "新しいイベントの掲載申請が届きました。\n内容を確認して、問題なければ回答シートの「掲載」にチェックを入れてください。\n\n" +
    SpreadsheetApp.getActiveSpreadsheet().getUrl() + "\n\n" + lines.join("\n\n")
  );
}

/**
 * 画像を一括で公開設定にする（最初に1回だけ手動で実行。ドライブの許可を求められたら「許可」）
 * 回答シートにある全部の画像を「リンクを知っている全員が閲覧可」にします
 */
function shareAllImages() {
  const sh = findResponseSheet_(SpreadsheetApp.getActiveSpreadsheet());
  let n = 0;
  for (let r = 2; r <= sh.getLastRow(); r++) n += shareImagesInRow_(sh, r);
  Logger.log(n + " 枚の画像を公開設定にしました");
}

/* ---------- 内部処理 ---------- */

function shareImagesInRow_(sh, row) {
  const heads = headers_(sh);
  let n = 0;
  ["image1", "image2"].forEach(key => {
    const c = colOf_(heads, FIELDS.find(f => f[0] === key)[1]);
    if (!c) return;
    const ids = String(sh.getRange(row, c).getValue()).match(/[-\w]{25,}/g) || [];
    ids.forEach(id => {
      DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      n++;
    });
  });
  return n;
}

function findResponseSheet_(ss) {
  const s = ss.getSheets().find(sh => sh.getFormUrl());
  if (!s) throw new Error("フォームの回答シートが見つかりません。フォームの「回答」→「スプレッドシートにリンク」で作ったスプレッドシートから実行してください。");
  return s;
}

const norm_ = s => String(s || "").normalize("NFKC").replace(/\s+/g, "");

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(norm_);
}

function colOf_(heads, names) {
  for (const n of names) {
    const i = heads.indexOf(norm_(n));
    if (i >= 0) return i + 1;
  }
  return 0;
}

function letter_(c) {
  let s = "";
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

function addAdminColumns_(resp) {
  ADMIN_COLS.forEach(name => {
    if (colOf_(headers_(resp), [name])) return;
    const c = resp.getLastColumn() + 1;
    resp.getRange(1, c).setValue(name).setFontWeight("bold").setBackground("#ffe8e1");
  });
  const heads = headers_(resp);
  const cb = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  ["掲載", "日程予定（未確定）"].forEach(n => resp.getRange(2, colOf_(heads, [n]), 1999, 1).setDataValidation(cb));
  resp.setFrozenRows(1);
}

/** 既存イベントを初期データとして入れる（1回だけ） */
function addInitialEvents_(resp) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("SEEDED")) return;

  const seed = [
    { posted: "2026-11-20", title: "あつまれ わかものの夜「忘年会」", date: "2026-12-05", time: "18:30〜21:00（出入り自由）", place: "Culevaシェアスペース クレバ", category: "若者限定", price: "2,000円（アルコールは別料金）", deadline: "2026-12-03", description: "あつ夜の忘年会！ ごはんとケーキ、自分で巻く惣菜クレープ、ゲームも。今年おつかれさまの会です。途中参加・途中退出OK。" },
    { posted: "2026-10-29", title: "ご褒美cafe Amatou", date: "2026-11-29", time: "13:00〜15:00", place: "Culevaシェアスペース クレバ", category: "若者限定", price: "2,000円", capacity: "30名（20〜30代向け）", deadline: "2026-11-13", description: "ケーキ・タルト・クレープ・ワッフル・アイスが楽しめるスイーツ会。クレープは好きな具材で自分で巻けます。" },
    { posted: "2026-10-01", title: "あつまれ わかものの夜「ボードゲーム会」", date: "2026-10-23", place: "Culevaシェアスペース クレバ", category: "若者限定", description: "あつ夜の第1回。ボードゲームで交流しました。" },
    { posted: "2026-11-20", title: "EAST END VIBES HAMANAKA", date: "2027-09-20", place: "浜中町", category: "町内イベント（中〜大規模）", description: "浜中町で開催する音楽フェス。日程・出演者などの詳細は決まりしだいお知らせします。", organizer: "EAST END VIBES HAMANAKA 実行委員会", tentative: true },
    { posted: "2026-10-01", title: "HAMANAKA HIKARI LABO 〜光で遊ぶ空間〜", category: "文化・体験", description: "光で遊べる体験型アート空間。日程は調整中です。" }
  ];
  const labels = { time: "時間", capacity: "定員", deadline: "申込締切" };

  const heads = headers_(resp);
  const width = resp.getLastColumn();
  const rows = seed.map(ev => {
    ev.organizer = ev.organizer || "SPARK NODE HAMANAKA";
    ev.apply = ev.apply || "主催者にお問い合わせください";
    const row = new Array(width).fill("");
    const extra = [];
    FIELDS.forEach(([key, names]) => {
      if (ev[key] === undefined || ev[key] === "") return;
      let v = ev[key];
      const c = colOf_(heads, names);
      if (DATE_FIELDS.indexOf(key) >= 0) v = new Date(v + "T00:00:00");
      if (c) row[c - 1] = v;
      else if (labels[key]) extra.push(labels[key] + "：" + ev[key]); // フォームに無い項目は説明文に入れる
    });
    const dc = colOf_(heads, FIELDS.find(f => f[0] === "description")[1]);
    if (dc && extra.length) row[dc - 1] = row[dc - 1] + "\n" + extra.join(" ／ ");
    row[colOf_(heads, ["掲載"]) - 1] = true;
    row[colOf_(heads, ["日程予定（未確定）"]) - 1] = !!ev.tentative;
    row[colOf_(heads, ["管理メモ"]) - 1] = "初期データ";
    return row;
  });
  // チェックボックス列は空行にも FALSE が入るので、A列（タイムスタンプ）で最後の行を探す
  const colA = resp.getRange(1, 1, resp.getMaxRows(), 1).getValues();
  let last = colA.length;
  while (last > 1 && colA[last - 1][0] === "") last--;
  resp.getRange(last + 1, 1, rows.length, width).setValues(rows);
  props.setProperty("SEEDED", "1");
}
