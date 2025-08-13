chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkLink") {
    fetch(request.url, { method: "HEAD" })
      .then(response => {
        sendResponse({ status: response.status, ok: response.ok });
      })
      .catch(error => {
        sendResponse({ status: 0, ok: false, error: error.message });
      });
    return true; // Indicates that sendResponse will be called asynchronously
  }
});
