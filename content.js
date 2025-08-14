const currentHost = location.hostname;

function processLink(link) {
	const href = link.getAttribute("href");
	const target = link.getAttribute("target");

	// target="_blank" のリンクを赤枠で表示（既存の枠より優先）
	if (target === "_blank") {
		link.style.setProperty("outline", "5px solid red", "important");
	}

	// 無効・空・特定スキームのリンクは無視
	if (!href) return;
	const lowerHref = href.trim().toLowerCase();
	if (
		lowerHref.startsWith("javascript:") ||
		lowerHref.startsWith("mailto:") ||
		lowerHref.startsWith("tel:") ||
		lowerHref.startsWith("sms:") ||
		lowerHref.startsWith("data:") ||
		lowerHref.startsWith("blob:") ||
		lowerHref.startsWith("about:")
	) {
		return;
	}

	// 同じページ内のアンカー
	if (href.startsWith("#")) {
		const id = href.substring(1);
		if (id && document.getElementById(id)) {
			applyHighlightStyles(link, { bg: "#ADD8E6", color: "black" });
			link.title = `参照IDが存在します: ${href}`;
		} else if (id) {
			applyHighlightStyles(link, { bg: "#D3D3D3", color: "white" });
			link.title = `参照IDが見つかりません: ${href}`;
		}
		return;
	}

	// 判定：絶対URLか相対パスか
	if (href.startsWith("http") || href.startsWith("//")) {
		try {
			const url = new URL(href);
			if (url.hostname === currentHost) {
				applyHighlightStyles(link, { bg: "lightgreen", color: "black", outline: "2px solid green" });
			} else {
				applyHighlightStyles(link, { bg: "pink", color: "black" });
			}
			checkLink(url.href, link);
		} catch {
			return;
		}
	} else if (href.startsWith("/") && !href.startsWith("//")) {
		// ルート相対
		applyHighlightStyles(link, { bg: "lightgreen", color: "black", outline: "2px solid green" });
		try {
			const resolvedUrl = new URL(href, location.href);
			checkLink(resolvedUrl.href, link, true);
		} catch {
			return;
		}
	} else if (href.includes(currentHost)) {
		// 文字列としてホスト名を含む絶対URL
		applyHighlightStyles(link, { bg: "lightgreen", color: "black", outline: "2px solid green" });
		checkLink(href, link);
	} else {
		// その他の相対
		applyHighlightStyles(link, { bg: "lightgreen", color: "black", outline: "2px solid green" });
		try {
			const resolvedUrl = new URL(href, location.href);
			checkLink(resolvedUrl.href, link, true);
		} catch {
			return;
		}
	}

	// プレビュー（重複バインド防止）
	if (!link.dataset.lhPreviewBound) {
		link.addEventListener("mouseenter", (e) => {
			const h = link.getAttribute("href");
			if (!h || h.startsWith("#") || /^(javascript:|mailto:|tel:|sms:|data:|blob:|about:)/i.test(h)) return;
			window.__lhPreviewTimeout = setTimeout(() => {
				const resolved = new URL(h, location.href).href;
				const c = window.__lhPreviewContainer;
				const f = window.__lhPreviewIframe;
				if (!c || !f) return;
				f.src = resolved;
				c.style.left = `${e.clientX + 20}px`;
				c.style.top = `${e.clientY + 20}px`;
				c.style.display = "block";
			}, 500);
		});
		link.addEventListener("mouseleave", () => {
			clearTimeout(window.__lhPreviewTimeout);
			const c = window.__lhPreviewContainer;
			const f = window.__lhPreviewIframe;
			if (c && f) {
				c.style.display = "none";
				f.src = "about:blank";
			}
		});
		link.dataset.lhPreviewBound = "1";
	}
}

// Utility to apply highlight styles on link and its first block child if needed
function applyHighlightStyles(link, { bg, color, outline }) {
	try {
		const firstChild = link.firstElementChild;
		const hasBlockChild = (() => {
			if (!firstChild) return false;
			const d = getComputedStyle(firstChild).display;
			return d === "block" || d === "flex" || d === "grid" || d === "inline-block";
		})();

		// Prefer styling the block-like child if present to avoid inline a quirks
		const target = hasBlockChild ? firstChild : link;

		if (bg) target.style.setProperty("background-color", bg, "important");
		if (color) target.style.setProperty("color", color, "important");
		if (outline) target.style.setProperty("outline", outline, "important");

		// Ensure target box renders as a cohesive area
		target.style.setProperty("box-sizing", "border-box", "important");

		// If we styled the child, clear conflicting styles on the anchor to avoid stray outlines
		if (target !== link && outline) {
			link.style.setProperty("outline", "none", "important");
		}
	} catch (e) {
		console.error("Link Highlighter: Error applying styles", e);
	}
}


// 初期処理
Array.from(document.querySelectorAll("a[href]")).forEach(processLink);

// プレビュー用要素（1回だけ作る）
(function ensurePreviewElements() {
	if (window.__lhPreviewContainer) return;
	const container = document.createElement("div");
	container.id = "link-highlighter-preview-container";
	container.style.display = "none";
	container.style.position = "fixed";
	container.style.zIndex = "10000";
	container.style.border = "2px solid #ccc";
	container.style.borderRadius = "5px";
	container.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";
	container.style.backgroundColor = "white";
	container.style.width = "800px";
	container.style.height = "600px";
	container.style.overflow = "hidden";

	const iframe = document.createElement("iframe");
	iframe.id = "link-highlighter-preview-iframe";
	iframe.style.width = "1280px";
	iframe.style.height = "720px";
	iframe.style.border = "none";
	iframe.style.transformOrigin = "top left";
	iframe.style.transform = `scale(${800 / 1280})`;

	container.appendChild(iframe);
	document.body.appendChild(container);
	window.__lhPreviewContainer = container;
	window.__lhPreviewIframe = iframe;
})();

// 動的追加への対応
const observer = new MutationObserver((mutations) => {
	for (const m of mutations) {
		if (m.type === "childList") {
			m.addedNodes.forEach(node => {
				if (node.nodeType !== 1) return;
				if (node.matches && node.matches("a[href]")) processLink(node);
				const anchors = node.querySelectorAll ? node.querySelectorAll("a[href]") : [];
				anchors.forEach(processLink);
			});
		} else if (m.type === "attributes" && m.target.matches && m.target.matches("a[href]")) {
			processLink(m.target);
		}
	}
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "target"] });

// 🔍 リンク切れチェック関数
function checkLink(url, link, removeOutline = false) {
	chrome.runtime.sendMessage({ action: "checkLink", url: url }, response => {
		if (!response) return;
		const { status, ok } = response;
		if (ok === true) return;
		if (status === 0 || typeof status !== "number") return;
		if (status >= 400 && status < 600) {
			link.style.setProperty("background-color", "#8B4513", "important");
			link.style.setProperty("color", "white", "important");
			link.title = `リンク切れ（ステータス: ${status}）`;
			if (removeOutline) link.style.setProperty("outline", "none", "important");
		}
	});
}
