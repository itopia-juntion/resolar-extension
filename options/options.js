// options/options.js
(async () => {
  const input = document.getElementById("greeting");
  const { greeting = "안녕하세요!" } = await chrome.storage.sync.get("greeting");
  input.value = greeting;

  input.addEventListener("change", async () => {
    await chrome.storage.sync.set({ greeting: input.value.trim() || "안녕하세요!" });
  });
})();
