// =====================================================
// サイトの設定（ここだけ書き換えればOK）
// =====================================================
window.SITE_CONFIG = {
  // スプレッドシート「公開用」タブを「ウェブに公開（CSV）」したURL
  // 空のままだと data/events.json を読み込みます
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5XMqcV_k7QEOYoCVN6wTt7Ju9E1ei3hIfikLu8zCYZ9tekO7D6JdqsOfklAmTEM-VgkH0Lc2r9pUX/pub?gid=1448576913&single=true&output=csv",

  // 主催者向け「イベント掲載申請フォーム」のURL（https://docs.google.com/forms/d/e/.../viewform）
  // 空のままだと「掲載申請」ボタンは表示されません
  FORM_URL: "https://forms.gle/W5fUZy2moYaimNNK6",

  // 定期活動・サークル：スプレッドシート「定期活動_公開用」タブを「ウェブに公開（CSV）」したURL
  // 空のままだと data/regular.json を読み込みます
  REGULAR_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5XMqcV_k7QEOYoCVN6wTt7Ju9E1ei3hIfikLu8zCYZ9tekO7D6JdqsOfklAmTEM-VgkH0Lc2r9pUX/pub?gid=128210075&single=true&output=csv",

  // 「サークルを掲載」ボタンのフォームURL（空のままだと「準備中」と表示）
  REGULAR_FORM_URL: "https://forms.gle/qxWPcJKKXZq7FkZu5",

  // 町外イベント：スプレッドシート「町外_公開用」タブを「ウェブに公開（CSV）」したURL
  // 空のままだと data/outside.json を読み込みます
  OUTSIDE_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS5XMqcV_k7QEOYoCVN6wTt7Ju9E1ei3hIfikLu8zCYZ9tekO7D6JdqsOfklAmTEM-VgkH0Lc2r9pUX/pub?gid=520000002&single=true&output=csv",

  // InstagramのURL（空のままだとInstagramのボタンは表示されません）
  INSTAGRAM_URL: "https://www.instagram.com/hamanaka_event_calendar/",

  // 公式LINEの友だち追加URL（空のままだとLINEのボタンは表示されません）
  LINE_URL: "https://lin.ee/xO0jxrX",

  // お問い合わせフォームのURL（空のままだとお問い合わせのリンクは表示されません）
  CONTACT_URL: "https://forms.gle/BH6mjGzeyhJpRUx88",

  // フッターに出す運営者名
  OPERATOR: "SPARK NODE HAMANAKA"
};
