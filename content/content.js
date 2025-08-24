let isHighlightingEnabled = false;
const HIGHLIGHT_CLASS = 'resolar-highlight-span';

// 하이라이트 스타일을 페이지에 주입하는 함수
function injectHighlightStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: yellow; 
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}
injectHighlightStyles();

const handleMouseUp = () => {
  if (!isHighlightingEnabled) return;

  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) {
    return;
  }

  const range = selection.getRangeAt(0);
  const selectedText = range.toString().trim();

  if (selectedText.length > 0) {
    // 이미 하이라이트된 텍스트의 일부인지 확인
    if (range.startContainer.parentElement.classList.contains(HIGHLIGHT_CLASS) || 
        range.endContainer.parentElement.classList.contains(HIGHLIGHT_CLASS)) {
      return;
    }

    const span = document.createElement('span');
    span.className = HIGHLIGHT_CLASS;
    try {
      range.surroundContents(span);
    } catch (e) {
      console.warn('Resolar: 선택 영역을 하이라이트할 수 없습니다. (예: 여러 태그에 걸쳐있음)', e);
    }
    selection.removeAllRanges(); // 선택 해제
  }
};

const handleHighlightClick = (event) => {
  if (!isHighlightingEnabled) return;

  const target = event.target;
  if (target.classList.contains(HIGHLIGHT_CLASS)) {
    const parent = target.parentNode;
    while (target.firstChild) {
      parent.insertBefore(target.firstChild, target);
    }
    parent.removeChild(target);
    parent.normalize(); // 텍스트 노드 병합
  }
};

// 하이라이트 기능 활성화/비활성화
function setHighlighting(enabled) {
  isHighlightingEnabled = enabled;
  if (enabled) {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleHighlightClick);
  } else {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('click', handleHighlightClick);
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "getContent":
      sendResponse({ content: document.body.innerText });
      break;

    case "toggleHighlighting":
      setHighlighting(request.enabled);
      sendResponse({ success: true });
      break;

    case "getHighlights":
      const highlights = Array.from(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`))
                              .map(span => span.textContent.trim())
                              .filter(text => text.length > 0);
      sendResponse({ highlights: highlights });
      break;
  }
  return true;
});

chrome.storage.local.get([`highlight-enabled-${chrome.runtime.id}`], (result) => {
});
