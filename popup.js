// popup.js — SnapClip Popup UI logic

const startSnipBtn = document.getElementById('startSnip');
const snipsList    = document.getElementById('snipsList');
const snipsEmpty   = document.getElementById('snipsEmpty');
const snipsCount   = document.getElementById('snipsCount');
const clearAllBtn  = document.getElementById('clearAll');

// ── Trigger snipping in the active tab ───────────────────────────────────────
startSnipBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'START_SNIP' }, () => {
      if (chrome.runtime.lastError) {
        alert("SnapClip cannot run on this internal Chrome page or before it finishes loading. Please try on a regular webpage.");
        return;
      }
      // Close the popup so the overlay is fully visible
      window.close();
    });
  });
});

// ── Load and render active snips list ────────────────────────────────────────
function loadSnips() {
  chrome.storage.local.get(null, (items) => {
    const snips = Object.entries(items).filter(([k]) => k.startsWith('snip_'));
    snipsCount.textContent = snips.length;
    clearAllBtn.style.display = snips.length > 0 ? 'block' : 'none';

    // Clear existing items (except the empty placeholder)
    Array.from(snipsList.querySelectorAll('.snip-item')).forEach(el => el.remove());

    if (snips.length === 0) {
      snipsEmpty.style.display = 'block';
      return;
    }
    snipsEmpty.style.display = 'none';

    snips.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    snips.forEach(([snipId, snip]) => {
      const item = document.createElement('div');
      item.className = 'snip-item';

      const thumb = document.createElement('img');
      thumb.className = 'snip-thumb';
      thumb.src = snip.dataURL;
      thumb.alt = snip.label || 'Snip';

      const info = document.createElement('div');
      info.className = 'snip-info';
      const infoLabel = document.createElement('div');
      infoLabel.className = 'snip-info-label';
      infoLabel.textContent = snip.label || snipId;
      info.appendChild(infoLabel);

      const delBtn = document.createElement('button');
      delBtn.className = 'snip-del';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Remove this snip';
      delBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DISMISS_SNIP', snipId }, () => {
          loadSnips();
        });
      });

      item.append(thumb, info, delBtn);
      snipsList.appendChild(item);
    });
  });
}

// ── Clear all snips ───────────────────────────────────────────────────────────
clearAllBtn.addEventListener('click', () => {
  chrome.storage.local.get(null, (items) => {
    const snipKeys = Object.keys(items).filter(k => k.startsWith('snip_'));
    snipKeys.forEach(snipId => {
      chrome.runtime.sendMessage({ type: 'DISMISS_SNIP', snipId });
    });
    chrome.storage.local.remove(snipKeys, loadSnips);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadSnips();

// Refresh list when storage changes (e.g. new snip taken from tab)
chrome.storage.onChanged.addListener(loadSnips);
