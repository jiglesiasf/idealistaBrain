// Runs at document_start in MAIN world on localhost and Vercel.
// Publishes the extension's real runtime ID so the web app can reach it
// regardless of which env var or extension variant (local/production) is installed.
window.__IDEALISTA_BRAIN_EXTENSION_ID__ = chrome.runtime.id;
