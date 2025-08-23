
// content/content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    /*const article = document.querySelector("article");
    if (article) {
      sendResponse({ content: article.innerText });
      return;
    }

    const main = document.querySelector("main");
    if (main) {
      sendResponse({ content: main.innerText });
      return;
    }*/

    sendResponse({ content: document.body.innerText });
  }
});
