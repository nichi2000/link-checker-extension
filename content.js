const currentHost = location.hostname;

// --- リンク処理のメイン関数 ---
function processLink(link) {
    // 既に処理済みの場合はスキップ
    if (link.dataset.linkHighlighterProcessed) return;

    const href = link.getAttribute("href");
    const target = link.getAttribute("target");

    // --- スタイル適用ロジック ---
    // target="_blank" のリンクを赤枠で表示
    if (target === "_blank") {
        link.style.setProperty("outline", "5px solid red", "important");
    }

    // 無効・空・スクリプトのリンクは無視
    if (!href || href.startsWith("javascript:")) {
        link.dataset.linkHighlighterProcessed = "true";
        return;
    }

    // 同じページ内のアンカーリンクのチェック
    if (href.startsWith("#")) {
        const id = href.substring(1);
        if (id && document.getElementById(id)) {
            link.style.setProperty("background-color", "#ADD8E6", "important");
            link.style.setProperty("color", "black", "important");
            link.title = `参照IDが存在します: ${href}`;
        } else if (id) {
            link.style.setProperty("background-color", "#D3D3D3", "important");
            link.style.setProperty("color", "white", "important");
            link.title = `参照IDが見つかりません: ${href}`;
        }
        // ここでreturnせずに、後続のプレビューイベントバインド処理へ進める
    } else if (href.startsWith("http") || href.startsWith("//")) {
        try {
            const url = new URL(href);
            if (url.hostname === currentHost) {
                // 内部リンク
                link.style.setProperty("background-color", "lightgreen", "important");
                link.style.setProperty("color", "black", "important");
                link.style.setProperty("outline", "2px solid green", "important");
            } else {
                // 外部リンク
                link.style.setProperty("background-color", "pink", "important");
                link.style.setProperty("color", "black", "important");
            }
            checkLink(url.href, link);
        } catch (e) { /* 無効なURL */ }
    } else {
        // 相対パス（内部リンク）
        link.style.setProperty("background-color", "lightgreen", "important");
        link.style.setProperty("color", "black", "important");
        link.style.setProperty("outline", "2px solid green", "important");
        try {
            const resolvedUrl = new URL(href, location.href);
            checkLink(resolvedUrl.href, link, true);
        } catch (e) { /* 無効なURL */ }
    }

    // --- プレビューイベントのバインド ---
    link.addEventListener("mouseenter", handleMouseEnter);
    link.addEventListener("mouseleave", handleMouseLeave);

    link.dataset.linkHighlighterProcessed = "true";
}

// --- プレビュー機能 ---
let previewTimeout;
const previewContainer = document.createElement("div");
const previewIframe = document.createElement("iframe");
const anchorPreviewContent = document.createElement("div"); // アンカープレビュー用の新しいdiv

function setupPreviewElements() {
    previewContainer.id = "link-highlighter-preview-container";
    previewContainer.style.cssText = `
        display: none;
        position: fixed;
        z-index: 10000;
        border: 2px solid #ccc;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        background-color: white;
        width: 800px;
        height: 600px;
        overflow: hidden;
    `;
    previewIframe.id = "link-highlighter-preview-iframe";
    previewIframe.style.cssText = `
        width: 1280px;
        height: 720px;
        border: none;
        transform-origin: top left;
        transform: scale(${800 / 1280});
    `;
    anchorPreviewContent.id = "link-highlighter-anchor-preview";
    anchorPreviewContent.style.cssText = `
        width: 100%;
        height: 100%;
        overflow: auto;
        padding: 15px;
        box-sizing: border-box;
    `;
    previewContainer.appendChild(previewIframe);
    previewContainer.appendChild(anchorPreviewContent);
    document.body.appendChild(previewContainer);
}

function handleMouseEnter(e) {
    const link = e.currentTarget;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("javascript:")) return;

    clearTimeout(previewTimeout);

    previewTimeout = setTimeout(() => {
        if (href.startsWith("#")) {
            // --- アンカーリンクのプレビュー処理 ---
            const id = href.substring(1);
            if (!id) return;
            const targetElement = document.getElementById(id);
            if (!targetElement) return;

            // コンテナを準備
            previewIframe.style.display = 'none';
            anchorPreviewContent.style.display = 'block';
            anchorPreviewContent.innerHTML = ''; // 前の内容をクリア

            // 要素をクローンして追加
            const clone = targetElement.cloneNode(true);
            clone.removeAttribute('id'); // IDの重複を避ける
            anchorPreviewContent.appendChild(clone);

        } else {
            // --- 通常URLのプレビュー処理 ---
            try {
                // コンテナを準備
                anchorPreviewContent.style.display = 'none';
                previewIframe.style.display = 'block';
                
                const resolvedUrl = new URL(href, location.href).href;
                previewIframe.src = resolvedUrl;
            } catch (err) {
                return; // 無効なURL
            }
        }
        
        // メインコンテナを位置調整して表示
        const x = e.clientX + 20;
        const y = e.clientY + 20;
        previewContainer.style.left = `${x}px`;
        previewContainer.style.top = `${y}px`;
        previewContainer.style.display = "block";
    }, 500);
}

function handleMouseLeave() {
    clearTimeout(previewTimeout);
    previewContainer.style.display = "none";
    previewIframe.src = "about:blank";
    anchorPreviewContent.innerHTML = ''; // アンカープレビューもクリア
}

// --- 初期化処理 ---
setupPreviewElements();
document.querySelectorAll("a[href]").forEach(processLink);

// --- 動的コンテンツ監視 ---
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    if (node.matches('a[href]')) {
                        processLink(node);
                    }
                    node.querySelectorAll('a[href]').forEach(processLink);
                }
            });
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// 🔍 リンク切れチェック関数
function checkLink(url, link, removeOutline = false) {
    chrome.runtime.sendMessage({ action: "checkLink", url: url }, response => {
        if (!response) return;
        const { status, ok } = response;
        if (ok) return;
        if (status === 0 || typeof status !== "number") return;
        if (status >= 400 && status < 600) {
            link.style.setProperty("background-color", "#8B4513", "important");
            link.style.setProperty("color", "white", "important");
            link.title = `リンク切れ（ステータス: ${status}）`;
            if (removeOutline) link.style.setProperty("outline", "none", "important");
        }
    });
}
