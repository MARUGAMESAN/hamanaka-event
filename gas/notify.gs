/**
 * はまなかイベントカレンダー：フォーム送信の通知メール（イベント申請・サークル申請・お問い合わせ）
 *
 * 1つのスプレッドシートに3つのフォームがつながっているので、
 * どのフォームから届いたかを見分けて、件名と本文を変えて通知します。
 *
 * 使い方
 *  1. 回答スプレッドシートの「拡張機能 > Apps Script」で、ファイルを1つ追加（＋ > スクリプト）し、
 *     名前を「notify」にして、このファイルの中身をすべて貼り付けて保存
 *  2. 関数「switchNotifyTrigger」を選んで1回だけ「実行」（権限の許可が出たら許可）
 *     → これまでの通知（notifyNewSubmission）から、この通知に切り替わります
 *  3. 関数「testNotifyMail」を実行すると、テストのメールが1通届きます
 *
 * 通知先は setup の NOTIFY_TO と、このスクリプトを実行した人です（setup 側の設定をそのまま使います）
 */

function notifySubmission(e) {
  // エディタから直接「実行」したとき（フォーム送信ではない）は何もしない
  if (!e || !e.range) {
    console.log("notifySubmission はフォーム送信のときに自動で動く関数です。switchNotifyTrigger → testNotifyMail の順に実行してください。");
    return;
  }
  const sh = e.range.getSheet();
  const row = e.range.getRow();
  const heads = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const has = name => heads.some(h => h.indexOf(name) >= 0);
  const kind = has("サークル名") ? "circle" : has("お問い合わせ内容") ? "contact" : "event";

  // 申請（イベント・サークル）の行には「掲載」などのチェックボックスを付け、画像を共有する
  if (kind !== "contact") {
    const cb = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    ["掲載", "日程予定（未確定）"].forEach(n => {
      const c = heads.indexOf(n) + 1;
      if (c > 0) sh.getRange(row, c).setDataValidation(cb);
    });
    try { shareImagesInRow_(sh, row); } catch (err) { console.log(err); }
  }

  const nv = (e && e.namedValues) || {};
  const val = k => { const key = Object.keys(nv).find(x => x.indexOf(k) >= 0); return key ? String(nv[key][0] || "").trim() : ""; };
  const skip = ["掲載", "日程予定（未確定）", "管理メモ", "最終確認日"];
  const body = Object.keys(nv)
    .filter(k => k && skip.indexOf(k) < 0 && String(nv[k].join("")).trim() !== "")
    .map(k => "■ " + k + "\n" + nv[k].join(", "))
    .join("\n\n");
  const url = SpreadsheetApp.getActiveSpreadsheet().getUrl() + "#gid=" + sh.getSheetId();

  let subject, lead;
  if (kind === "contact") {
    const type = val("お問い合わせ内容") || "お問い合わせ";
    const reply = val("返信");
    subject = `【${SITE_NAME}】お問い合わせ：${type}${reply === "必要" ? "（返信必要）" : ""}`;
    lead = "お問い合わせが届きました。" + (reply === "必要" ? "\n※ 返信が必要です。連絡先あてにご返信ください。" : "");
  } else if (kind === "circle") {
    subject = `【${SITE_NAME}】サークル掲載申請：${val("サークル名")}`;
    lead = "サークル・定期活動の掲載申請が届きました。\n内容を確認して、問題なければ「掲載」にチェックを入れてください。";
  } else {
    subject = `【${SITE_NAME}】イベント掲載申請：${val("イベント名")}`;
    lead = "イベントの掲載申請が届きました。\n内容を確認して、問題なければ「掲載」にチェックを入れてください。";
  }

  const to = [Session.getEffectiveUser().getEmail()].concat(typeof NOTIFY_TO !== "undefined" ? NOTIFY_TO : [])
    .map(s => String(s).trim()).filter(Boolean).join(",");
  MailApp.sendEmail(to, subject, `${lead}\n\n${url}\n\n${body}`);
}

// これまでの通知トリガーを、この notifySubmission に切り替える（1回だけ実行）
function switchNotifyTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers()
    .filter(t => ["notifyNewSubmission", "notifySubmission"].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("notifySubmission").forSpreadsheet(ss).onFormSubmit().create();
  console.log("✅ 通知を notifySubmission に切り替えました（イベント・サークル・お問い合わせの3つに対応）");
}

// テストメールを1通送る（届くかどうかの確認用）
function testNotifyMail() {
  const to = [Session.getEffectiveUser().getEmail()].concat(typeof NOTIFY_TO !== "undefined" ? NOTIFY_TO : [])
    .map(s => String(s).trim()).filter(Boolean).join(",");
  MailApp.sendEmail(to, `【${SITE_NAME}】通知メールのテスト`, "このメールが届いていれば、通知の設定は正常です。");
  console.log("テストメールを送りました：" + to);
}
