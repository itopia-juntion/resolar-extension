// background.js (service worker, MV3)
// 설치 시 기본값 저장
chrome.runtime.onInstalled.addListener(async () => {
  console.log("MV3 Starter installed.");
});

// 전체 페이지 캡처 유틸
async function waitTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function captureFullPageForUrl(url) {
  const bgTab = await chrome.tabs.create({ url, active: false });
  await waitTabLoad(bgTab.id);

  const target = { tabId: bgTab.id };
  const send = (method, params = {}) => new Promise((res, rej) =>
    chrome.debugger.sendCommand(target, method, params, (r) => {
      const e = chrome.runtime.lastError; e ? rej(e) : res(r || {});
    })
  );

  try {
    await chrome.debugger.attach(target, "1.3");
    await send("Page.enable");
    await send("Runtime.enable");

    const { result } = await send("Runtime.evaluate", {
        expression: `({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        })`,
        returnByValue: true,
    });
    const { width, height } = result.value;

    await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
    });

    const { data } = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true, // 서페이스를 기준으로 캡처
    });

    await send("Emulation.clearDeviceMetricsOverride");

    await chrome.downloads.download({
      url: "data:image/png;base64," + data,
      filename: `fullpage-${Date.now()}.png`,
    });
  } finally {
    try { await send("Runtime.disable"); } catch {}
    try { await send("Page.disable"); } catch {}
    try { await chrome.debugger.detach(target); } catch {}
    try { await chrome.tabs.remove(bgTab.id); } catch {}
  }
}

// 액션 아이콘 클릭 시에도 캡처 동작
chrome.action.onClicked.addListener(async (activeTab) => {
  if (!activeTab || !activeTab.url) return;
  await captureFullPageForUrl(activeTab.url);
});

// 팝업에서 메시지로 캡처 트리거
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CAPTURE_FULLPAGE") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) throw new Error("탭 URL을 찾을 수 없습니다.");
        await captureFullPageForUrl(tab.url);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      }
    })();
    return true; // 비동기 응답
  }
});
