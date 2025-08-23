// popup/popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const urlSpan = document.getElementById("url");
  const saveButton = document.getElementById("save-page-button");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    urlSpan.textContent = tab.url || "(알 수 없음)";
  }

  saveButton.addEventListener("click", async () => {
    if (!tab) {
      status.textContent = "탭 정보를 가져올 수 없습니다.";
      return;
    }

    status.textContent = "콘텐츠를 추출하는 중...";
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "getContent",
      });
    } catch (e) {
      status.textContent = "콘텐츠를 가져올 수 없습니다!";
      return;
    }

    const data = {
      title: tab.title,
      url: tab.url,
      content: response.content,
      timestamp: new Date().toISOString(),
    };

    status.textContent = "서버로 전송하는 중...";
    try {
      const res = await fetch("https://example.com/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        status.textContent = "페이지가 성공적으로 저장되었습니다!";
      } else {
        status.textContent = `오류: ${res.status} ${res.statusText}`;
      }
    } catch (error) {
      status.textContent = `전송 중 오류가 발생했습니다: ${error.message}`;
    }
  });
});
