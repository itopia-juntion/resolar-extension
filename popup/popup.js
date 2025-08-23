// popup/popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const urlSpan = document.getElementById("url");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) urlSpan.textContent = tab.url || "(알 수 없음)";
});
