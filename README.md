# SnapClip — Advanced Snipping Tool Chrome Extension

## 🚀 Installation (takes 30 seconds)

1. **Download & extract** the `snip-extension` zip file  to your computer
2. Unzip the folder.
3. Open Chrome and go to: `chrome://extensions/`
4. Enable **Developer Mode** (toggle in the top-right corner)
5. Click **"Load unpacked"**
6. Select the `snip-extension` folder(Unziped folder)
7. ✅ Done! The SnapClip icon appears in your Chrome toolbar

---

## 🎯 How to Use

1. **Click the SnapClip icon** in the Chrome toolbar
2. Click **"Capture Region"** in the popup
3. Your cursor becomes a **crosshair** and the page dims
4. **Click and drag** to select any area on the page
5. Release — your snip appears in a **floating popup**
6. The popup **persists across all tabs** — switch tabs freely!

---

## 🛠 Popup Controls

| Action | How |
|--------|-----|
| **Move popup** | Drag the header bar |
| **Resize popup** | Drag the bottom-right corner handle, or left/right/bottom edges |
| **Minimize** | Click the `—` button in the header |
| **Copy image** | Click the copy icon button |
| **Close** | Click the `✕` button |
| **Cancel snipping** | Press `ESC` |

---

## ✨ Features

- **Neon selection border** — bright cyan glow shows exactly what you're capturing
- **Persists across tabs** — snips stay visible as you navigate between tabs
- **Multiple snips** — open as many snip popups as you need simultaneously
- **Shadow DOM isolation** — never conflicts with page CSS (works on YouTube, Gmail, etc.)
- **High z-index** — appears above videos, modals, and overlays
- **Copy to clipboard** — paste your snip directly into any text field or app
- **Manage snips** — view and delete active snips from the extension popup

---

## 🌐 Compatibility

- ✅ YouTube
- ✅ Gmail
- ✅ Google Docs (view mode)
- ✅ Twitter / X
- ✅ GitHub
- ✅ News sites, blogs, documentation
- ⚠️ Chrome internal pages (`chrome://...`) — not supported by browser policy

---

## 📝 Notes

- For **cross-origin iframes** (e.g. embedded YouTube videos), the captured region
  will show a placeholder due to browser security restrictions. The popup itself
  still works normally.
- Snips are stored locally in `chrome.storage.local` and persist until you
  close them or click "Clear all" in the popup.


  ---NOTE: IF THE EXTENSION DOSENT WORK RELOAD THE WEBPAGE---
