// Runs at document_start in isolated world on localhost and Vercel.
// sessionStorage is shared between content scripts and the page (same origin),
// so the web app can read the real extension ID without world: "MAIN".
try {
  sessionStorage.setItem("__idealista_brain_ext_id__", chrome.runtime.id);
} catch {}
