const currentHost = location.hostname;

document.querySelectorAll("a[href]").forEach(link => {
  const href = link.getAttribute("href");
  const target = link.getAttribute("target");

  // target="_blank" のリンクを赤枠で表示
  if (target === "_blank") {
    link.style.outline = "5px solid red";
  }

  // 無効・空・スクリプトのリンクは無視
  if (!href || href.startsWith("javascript:")) return;

  // 同じページ内のアンカーリンクのチェック
  if (href.startsWith("#")) {
    const id = href.substring(1);
    if (id && document.getElementById(id)) {
      link.style.backgroundColor = "#ADD8E6"; // 薄い青色
      link.style.color = "black";
      link.title = `参照IDが存在します: ${href}`;
    } else if (id) {
      link.style.backgroundColor = "#D3D3D3"; // 灰色
      link.style.color = "white";
      link.title = `参照IDが見つかりません: ${href}`;
    }
    return;
  }

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
      // 無効なURL、またはサポートされていないスキーム（例: havascript:）
      return; // 処理を中断
    }

  } else if (href.includes(currentHost)) {
    // hostname が文字列として含まれている場合（たとえば href="https://example.com/page"）
    type = "internal_absolute";
    link.style.backgroundColor = "lightgreen";
    link.style.color = "black";

    // ここではURLの検証は不要。background.js側でfetchが失敗するのを待つ。
    checkLink(href, link);

  } else {
    // 相対パスとみなす（内部リンク）
    type = "internal_relative";
    link.style.outline = "2px solid green";

    try {
      const resolvedUrl = new URL(href, location.href);
      checkLink(resolvedUrl.href, link, true);
    } catch (e) {
      // 無効なURL、またはサポートされていないスキーム（例: havascript:）
      return; // 処理を中断
    }
  }
});

// 🔍 リンク切れチェック関数
function checkLink(url, link, removeOutline = false) {
	chrome.runtime.sendMessage({ action: "checkLink", url: url }, response => {
		if (!response) return;
		const { status, ok } = response;

		// 成功扱い
		if (ok === true) return;

		// 不明や到達のみ（status=0など）は塗らない
		if (status === 0 || typeof status !== "number") return;

		// 4xx/5xx のみ明確な失敗として塗る
		if (status >= 400 && status < 600) {
			link.style.backgroundColor = "#8B4513"; // 茶色
			link.style.color = "white";
			link.title = `リンク切れ（ステータス: ${status}）`;
			if (removeOutline) link.style.outline = "none"; // 相対パスの枠線を消す
		}
	});
}

// --- リンクホバープレビュー機能 ---

let previewTimeout;

// プレビュー用の要素を作成
const previewContainer = document.createElement("div");
previewContainer.id = "link-highlighter-preview-container";
previewContainer.style.display = "none";
previewContainer.style.position = "fixed";
previewContainer.style.zIndex = "10000";
previewContainer.style.border = "2px solid #ccc";
previewContainer.style.borderRadius = "5px";
previewContainer.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";
previewContainer.style.backgroundColor = "white";
previewContainer.style.width = "800px"; // プレビュー画面の幅を大きく
previewContainer.style.height = "600px"; // プレビュー画面の高さを幅に合わせて調整
previewContainer.style.overflow = "hidden";

const previewIframe = document.createElement("iframe");
previewIframe.id = "link-highlighter-preview-iframe";
previewIframe.style.width = "1280px"; // PC版の幅を想定
previewIframe.style.height = "720px"; // PC版のアスペクト比を想定（適宜調整）
previewIframe.style.border = "none";
previewIframe.style.transformOrigin = "top left";
previewIframe.style.transform = `scale(${800 / 1280})`; // previewContainerの幅に合わせて縮小

previewContainer.appendChild(previewIframe);
document.body.appendChild(previewContainer);

// プレビュー表示イベントをリンクに追加
document.querySelectorAll("a[href]").forEach(link => {
    link.addEventListener("mouseenter", (e) => {
        const href = link.getAttribute("href");
        // プレビュー非対象のリンクは無視
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
            return;
        }

        previewTimeout = setTimeout(() => {
            const resolvedUrl = new URL(href, location.href).href;
            previewIframe.src = resolvedUrl;

            // 位置調整 (マウスカーソルの右下)
            const x = e.clientX + 20;
            const y = e.clientY + 20;
            previewContainer.style.left = `${x}px`;
            previewContainer.style.top = `${y}px`;

            previewContainer.style.display = "block";
        }, 500); // 500ms後に表示
    });

    link.addEventListener("mouseleave", () => {
        clearTimeout(previewTimeout);
        previewContainer.style.display = "none";
        previewIframe.src = "about:blank"; // iframeを空にする
    });
});
