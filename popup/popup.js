// popup/popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const urlSpan = document.getElementById("url");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) urlSpan.textContent = tab.url || "(알 수 없음)";

  // 캡처 버튼 동작
  const capBtn = document.getElementById("capture");
  if (capBtn) {
    capBtn.addEventListener("click", async () => {
      status.textContent = "캡처 중…";
      try {
        const res = await chrome.runtime.sendMessage({ type: "CAPTURE_FULLPAGE" });
        if (res && res.ok) {
          status.textContent = "다운로드가 시작되었습니다 ✅";
        } else {
          throw new Error(res && res.error ? res.error : "알 수 없는 오류");
        }
      } catch (e) {
        status.textContent = `캡처 실패: ${e.message || e}`;
        console.warn(e);
      }
    });
  }
});
