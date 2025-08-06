const currentHost = location.hostname;

document.querySelectorAll("a[href]").forEach(link => {
  const href = link.getAttribute("href");

  // 無効・空・スクリプト・アンカーリンクは無視
  if (!href || href.startsWith("javascript:") || href.startsWith("#")) return;

  let type = ""; // 判定用

  // 判定：絶対URLか相対パスか
  if (href.startsWith("http") || href.startsWith("//")) {
    try {
      const url = new URL(href);
      if (url.hostname === currentHost) {
        type = "internal_absolute";
        link.style.backgroundColor = "lightgreen";
        link.style.color = "black";
      } else {
        type = "external_absolute";
        link.style.backgroundColor = "pink";
        link.style.color = "black";
      }

      checkLink(url.href, link);

    } catch (e) {
      // 無効なURL
    }

  } else if (href.includes(currentHost)) {
    // hostname が文字列として含まれている場合（たとえば href="https://example.com/page"）
    type = "internal_absolute";
    link.style.backgroundColor = "lightgreen";
    link.style.color = "black";

    checkLink(href, link);

  } else {
    // 相対パスとみなす（内部リンク）
    type = "internal_relative";
    link.style.outline = "2px solid green";

    const resolvedUrl = new URL(href, location.href);
    checkLink(resolvedUrl.href, link, true);
  }
});

// 🔍 リンク切れチェック関数
function checkLink(url, link, removeOutline = false) {
  fetch(url, { method: "HEAD" })
    .then(response => {
      if (!response.ok) {
        link.style.backgroundColor = "#8B4513"; // 茶色
        link.style.color = "white";
        link.title = `リンク切れ（ステータス: ${response.status}）`;
        if (removeOutline) link.style.outline = "none"; // 相対パスの枠線を消す
      }
    })
    .catch(() => {
      // CORSなどで確認できないときは無視
    });
}
