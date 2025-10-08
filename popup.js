document.addEventListener('DOMContentLoaded', function() {
    var enableHighlightCheckbox = document.getElementById('enableHighlight');

    // 初期状態を読み込む
    chrome.storage.sync.get('highlightEnabled', function(data) {
        enableHighlightCheckbox.checked = data.highlightEnabled !== undefined ? data.highlightEnabled : false; // デフォルトはOFF
    });

    // チェックボックスの状態が変更されたら保存し、コンテンツスクリプトにメッセージを送信
    enableHighlightCheckbox.addEventListener('change', function() {
        var isEnabled = this.checked;
        chrome.storage.sync.set({'highlightEnabled': isEnabled});

        // 現在のタブにメッセージを送信
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "toggleHighlight", enabled: isEnabled});
        });
    });
});
