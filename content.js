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

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 480;
const VIRTUAL_IFRAME_WIDTH = 1280;
const VIRTUAL_IFRAME_HEIGHT = 1000;

const previewContainer = document.createElement("div");
const previewIframe = document.createElement("iframe"); // constに変更
const anchorPreviewContent = document.createElement("div"); // アンカープレビュー用の新しいdiv

// --- ページ読み込み時にheadとbodyの情報をキャッシュ ---
let cachedHeadHtml = '';
let cachedBodyClass = '';
let cachedBodyCriticalStyles = '';

// スタイル情報をキャッシュする関数
function cachePageStyles() {
    cachedHeadHtml = document.head.innerHTML;
    cachedBodyClass = document.body.className;
    const computedStyle = window.getComputedStyle(document.body);
    cachedBodyCriticalStyles = `
        margin: ${computedStyle.margin};
        padding: ${computedStyle.padding};
        font-family: ${computedStyle.fontFamily};
        font-size: ${computedStyle.fontSize};
        color: ${computedStyle.color};
        line-height: ${computedStyle.lineHeight};
        background-color: ${computedStyle.backgroundColor};
    `;
}

// ページの読み込み状態に応じてキャッシュを実行
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", cachePageStyles);
} else {
    cachePageStyles();
}


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
        width: ${PREVIEW_WIDTH}px;
        height: ${PREVIEW_HEIGHT}px;
        overflow: hidden;
    `;
    // 初期状態ではコンテナに何も入れず、bodyにだけ追加しておく
    document.body.appendChild(previewContainer);

    anchorPreviewContent.id = "link-highlighter-preview-message";
    anchorPreviewContent.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0.95);
        color: black;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 10px;
        box-sizing: border-box;
        font-size: 1.2em;
        z-index: 10001;
        display: none; /* 初期状態では非表示 */
    `;
    previewContainer.appendChild(anchorPreviewContent);

    // iframeを一度だけ作成し、previewContainerに追加
    previewIframe.id = "link-highlighter-preview-iframe";
    previewIframe.style.cssText = `
        width: ${VIRTUAL_IFRAME_WIDTH}px;
        height: ${VIRTUAL_IFRAME_HEIGHT}px;
        border: none;
        transform-origin: top left;
        transform: scale(${PREVIEW_WIDTH / VIRTUAL_IFRAME_WIDTH});
    `;
    previewContainer.appendChild(previewIframe);
}

function handleMouseEnter(e) {
    const link = e.currentTarget;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("javascript:")) return;

    // 既存のタイトルを保存し、クリア
    if (link.title) {
        link.dataset.originalTitle = link.title;
        link.title = '';
    }

    clearTimeout(previewTimeout);

    previewTimeout = setTimeout(() => {
        // --- iframeを毎回再生成 ---
        if (previewIframe) {
            // previewIframe.remove(); // 削除コードをコメントアウトまたは削除
        }
        // previewIframe = document.createElement("iframe"); // 再生成コードをコメントアウトまたは削除
        // previewIframe.id = "link-highlighter-preview-iframe";
        // previewIframe.style.cssText = `
        //     width: ${VIRTUAL_IFRAME_WIDTH}px;
        //     height: ${VIRTUAL_IFRAME_HEIGHT}px;
        //     border: none;
        //     transform-origin: top left;
        //     transform: scale(${PREVIEW_WIDTH / VIRTUAL_IFRAME_WIDTH});
        // `;
        // previewContainer.appendChild(previewIframe);

        // iframeのロードエラーを監視
        previewIframe.onload = () => {
            try {
                // iframeのコンテンツにアクセスを試みて、セキュリティエラーが発生するかどうかをチェック
                // クロスオリジンの場合はここでエラーが発生し、catchブロックに移行する
                const iframeDocument = previewIframe.contentDocument || previewIframe.contentWindow.document;
                if (iframeDocument && iframeDocument.body && iframeDocument.body.children.length > 0) {
                    // ロード成功と判断し、エラーメッセージを非表示にする
                    anchorPreviewContent.style.display = 'none';
                } else {
                    // ロードはされたがコンテンツがない（X-Frame-Optionsなどでブロックされた可能性）
                    anchorPreviewContent.textContent = 'このサイトはプレビューを許可していません。';
                    anchorPreviewContent.style.display = 'flex';
                }
            } catch (e) {
                // セキュリティエラーが発生した場合は、ロードがブロックされたと判断
                anchorPreviewContent.textContent = 'このサイトはプレビューを許可していません。';
                anchorPreviewContent.style.display = 'flex';
            }
        };
        previewIframe.onerror = () => {
            // ネットワークエラーなど、iframe自体がロードできなかった場合
            anchorPreviewContent.textContent = 'プレビューの読み込み中にエラーが発生しました。';
            anchorPreviewContent.style.display = 'flex';
        };

        if (href.startsWith("#")) {
            // --- アンカーリンクのプレビュー処理 ---
            const id = href.substring(1);
            if (!id) return;
            const targetElement = document.getElementById(id);
            if (!targetElement) return;

            const headHtml = cachedHeadHtml;
            const bodyClass = cachedBodyClass;
            const criticalStyles = cachedBodyCriticalStyles;

            // 遷移先の要素のみを取得
            const previewHtml = targetElement.outerHTML;

            previewIframe.srcdoc = `
                <!DOCTYPE html>
                <html>
                ${headHtml}
                <body class="${bodyClass}" style="${criticalStyles} overflow-y: auto; overflow-x: hidden;">
                    <div style="padding: 15px; font-size: 3em;">${previewHtml}</div>
                </body>
                </html>
            `;

        } else {
            // --- 通常URLのプレビュー処理 ---
            try {
                const resolvedUrl = new URL(href, location.href).href;
                previewIframe.src = resolvedUrl;
            } catch (err) {
                return; // 無効なURL
            }
        }

        // メインコンテナを表示し、位置を調整
        previewContainer.style.display = "block"; // ここに移動
        const previewWidth = previewContainer.offsetWidth;
        const previewHeight = previewContainer.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 基本位置をカーソルの右下に設定
        let x = e.clientX + 20;
        let y = e.clientY + 20;

        // 画面右端からはみ出す場合、カーソルの左側に表示
        if (x + previewWidth > viewportWidth - 10) {
            x = e.clientX - previewWidth - 20;
        }
        // 画面左端からはみ出す場合 (左に切り替えた後)、左端に寄せる
        if (x < 10) {
            x = 10;
        }

        // 画面下端からはみ出す場合、カーソルの上側に表示
        if (y + previewHeight > viewportHeight - 10) {
            y = e.clientY - previewHeight - 20;
        }
        // 画面上端からはみ出す場合 (上に切り替えた後)、上端に寄せる
        if (y < 10) {
            y = 10;
        }

        previewContainer.style.left = `${x}px`;
        previewContainer.style.top = `${y}px`;
    }, 300);
}

function handleMouseLeave(e) {
    const link = e.currentTarget;
    clearTimeout(previewTimeout);
    previewContainer.style.display = "none";
    
    // iframeをコンテナから削除してリセット
    if (previewIframe) {
        previewIframe.src = "about:blank"; // iframeのコンテンツをクリア
    }
    previewIframe = null; // ガベージコレクションを促す

    // 元のタイトルを復元
    if (link && link.dataset.originalTitle) {
        link.title = link.dataset.originalTitle;
        delete link.dataset.originalTitle;
    }
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
