chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkLink") {
    const url = request.url;

    const finalize = (status, ok) => {
      sendResponse({ status, ok });
    };

    const isOkStatus = (status) => status >= 200 && status < 400; // 2xx/3xx 成功扱い

    const getWithCors = () => {
      return fetch(url, { method: "GET", redirect: "follow" })
        .then(resp => ({ status: resp.status, ok: isOkStatus(resp.status) }))
        .catch(() => null);
    };

    const getWithNoCors = () => {
      return fetch(url, { method: "GET", mode: "no-cors", redirect: "follow" })
        .then(resp => ({ status: resp.status || 0, ok: false })) // opaque → 0
        .catch(() => ({ status: 0, ok: false }));
    };

    fetch(url, { method: "HEAD", redirect: "follow" })
      .then(async (response) => {
        if (isOkStatus(response.status)) {
          finalize(response.status, true);
          return;
        }
        // HEAD が 2xx/3xx 以外のときはまず GET (CORS) を試す
        const corsResult = await getWithCors();
        if (corsResult) {
          if (corsResult.ok) {
            finalize(corsResult.status, true);
          } else if (corsResult.status >= 400 && corsResult.status < 600) {
            finalize(corsResult.status, false);
          } else {
            // 想定外は no-cors にフォールバック
            const noCorsResult = await getWithNoCors();
            finalize(noCorsResult.status, false);
          }
          return;
        }
        // CORS で失敗した場合のフォールバック
        const noCorsResult = await getWithNoCors();
        finalize(noCorsResult.status, false);
      })
      .catch(async () => {
        // HEAD 自体が失敗 → GET(CORS)→no-cors の順で試す
        const corsResult = await getWithCors();
        if (corsResult) {
          if (corsResult.ok) return finalize(corsResult.status, true);
          if (corsResult.status >= 400 && corsResult.status < 600) return finalize(corsResult.status, false);
        }
        const noCorsResult = await getWithNoCors();
        finalize(noCorsResult.status, false);
      });

    return true;
  }
});
