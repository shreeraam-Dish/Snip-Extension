// content.js — SnapClip Core Engine
// Uses Shadow DOM for full isolation from host page styles

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let snipActive = false;
  let snipCount = 0;
  const renderedSnips = new Map(); // snipId → popup DOM node
  let hostEl = null;
  let shadowRoot = null;

  // ─── Bootstrap Shadow Host ────────────────────────────────────────────────
  function ensureShadowHost() {
    if (hostEl && document.body.contains(hostEl)) return;
    hostEl = document.createElement('snapclip-host');
    Object.assign(hostEl.style, {
      position: 'fixed',
      top: '0', left: '0',
      width: '0', height: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
      overflow: 'visible'
    });
    document.documentElement.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    injectStyles();
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      /* ── Overlay ─────────────────────────────── */
      .sc-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483640;
        cursor: crosshair;
        pointer-events: all;
      }
      .sc-dim {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.50);
        backdrop-filter: blur(0px);
        pointer-events: none;
        z-index: 2147483639;
        transition: opacity 0.15s ease;
      }

      /* ── Selection Box ────────────────────────── */
      .sc-selection {
        position: fixed;
        border: 2px solid #00ffe0;
        box-shadow:
          0 0 0 1px rgba(0,255,224,0.3),
          0 0 8px 2px #00ffe0,
          0 0 22px 6px rgba(0,255,224,0.45),
          0 0 50px 12px rgba(0,255,224,0.2);
        background: rgba(0,255,224,0.04);
        pointer-events: none;
        z-index: 2147483646;
        display: none;
      }
      .sc-selection::before, .sc-selection::after {
        content: '';
        position: absolute;
        background: #00ffe0;
        box-shadow: 0 0 6px #00ffe0;
        border-radius: 2px;
      }
      .sc-selection::before { /* crosshair horizontal */
        left: 50%; top: -1px;
        width: 1px; height: calc(100% + 2px);
        opacity: 0.25;
      }

      /* ── Size badge ───────────────────────────── */
      .sc-badge {
        position: fixed;
        background: rgba(0,255,224,0.9);
        color: #001a16;
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 4px;
        pointer-events: none;
        z-index: 2147483647;
        display: none;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }

      /* ── Popup Container ──────────────────────── */
      .sc-popup {
        position: fixed;
        z-index: 2147483647;
        pointer-events: all;
        border-radius: 14px;
        overflow: hidden;
        background: #0e1117;
        border: 1px solid rgba(0,255,224,0.18);
        box-shadow:
          0 2px 4px rgba(0,0,0,0.4),
          0 8px 24px rgba(0,0,0,0.5),
          0 24px 64px rgba(0,0,0,0.4),
          0 0 0 1px rgba(0,255,224,0.06),
          inset 0 1px 0 rgba(255,255,255,0.05);
        display: flex;
        flex-direction: column;
        min-width: 160px;
        min-height: 100px;
        animation: sc-pop-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
        user-select: none;
      }
      @keyframes sc-pop-in {
        from { opacity: 0; transform: scale(0.80) translateY(12px); }
        to   { opacity: 1; transform: scale(1)   translateY(0);    }
      }

      /* ── Popup Header ─────────────────────────── */
      .sc-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px 7px;
        background: linear-gradient(180deg, #141820 0%, #0e1117 100%);
        border-bottom: 1px solid rgba(0,255,224,0.10);
        cursor: move;
        flex-shrink: 0;
      }
      .sc-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #00ffe0;
        box-shadow: 0 0 6px #00ffe0;
        flex-shrink: 0;
        animation: sc-pulse 2.5s ease-in-out infinite;
      }
      @keyframes sc-pulse {
        0%,100% { box-shadow: 0 0 4px #00ffe0; opacity: 1; }
        50% { box-shadow: 0 0 10px #00ffe0, 0 0 20px rgba(0,255,224,0.5); opacity: 0.8; }
      }
      .sc-label {
        flex: 1;
        color: rgba(255,255,255,0.55);
        font-family: 'SF Mono','Fira Code',monospace;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .sc-btn {
        width: 22px; height: 22px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
        pointer-events: all;
        flex-shrink: 0;
      }
      .sc-btn:hover { background: rgba(255,255,255,0.10); color: #fff; border-color: rgba(255,255,255,0.2); }
      .sc-btn.close:hover { background: rgba(255,60,60,0.25); border-color: rgba(255,80,80,0.4); color: #ff6060; }
      .sc-btn.copy:hover { background: rgba(0,255,224,0.12); border-color: rgba(0,255,224,0.3); color: #00ffe0; }
      .sc-btn:active { transform: scale(0.90); }

      /* ── Image Area ───────────────────────────── */
      .sc-imgwrap {
        flex: 1;
        overflow: hidden;
        position: relative;
        background:
          linear-gradient(45deg, #111418 25%, transparent 25%),
          linear-gradient(-45deg, #111418 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #111418 75%),
          linear-gradient(-45deg, transparent 75%, #111418 75%);
        background-size: 10px 10px;
        background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
        background-color: #0d1015;
      }
      .sc-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }

      /* ── Resize Handle ────────────────────────── */
      .sc-resize {
        position: absolute;
        bottom: 0; right: 0;
        width: 18px; height: 18px;
        cursor: se-resize;
        z-index: 1;
        pointer-events: all;
      }
      .sc-resize::after {
        content: '';
        position: absolute;
        bottom: 4px; right: 4px;
        width: 7px; height: 7px;
        border-right: 2px solid rgba(0,255,224,0.4);
        border-bottom: 2px solid rgba(0,255,224,0.4);
        border-radius: 1px;
      }
      .sc-resize-l, .sc-resize-r {
        position: absolute;
        top: 0; bottom: 0; width: 5px;
        cursor: ew-resize;
        pointer-events: all;
        z-index: 1;
      }
      .sc-resize-l { left: 0; cursor: w-resize; }
      .sc-resize-r { right: 0; cursor: e-resize; }
      .sc-resize-b {
        position: absolute;
        left: 0; right: 0; bottom: 0; height: 5px;
        cursor: s-resize;
        pointer-events: all;
        z-index: 1;
      }

      /* ── Toast ────────────────────────────────── */
      .sc-toast {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(0,255,224,0.92);
        color: #001a16;
        font-family: 'SF Mono','Fira Code',monospace;
        font-size: 11px;
        font-weight: 700;
        padding: 7px 18px;
        border-radius: 99px;
        pointer-events: none;
        z-index: 2147483647;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }
      .sc-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* ── Hint banner ──────────────────────────── */
      .sc-hint {
        position: fixed;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(14,17,23,0.92);
        border: 1px solid rgba(0,255,224,0.3);
        color: rgba(255,255,255,0.75);
        font-family: 'SF Mono','Fira Code',monospace;
        font-size: 11px;
        padding: 8px 20px;
        border-radius: 99px;
        pointer-events: none;
        z-index: 2147483647;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,255,224,0.08);
        letter-spacing: 0.4px;
        animation: sc-slide-down 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
      }
      @keyframes sc-slide-down {
        from { opacity:0; transform: translateX(-50%) translateY(-10px); }
        to   { opacity:1; transform: translateX(-50%) translateY(0); }
      }
      .sc-hint span { color: #00ffe0; font-weight: 700; }
    `;
    shadowRoot.appendChild(s);
  }

  // ─── Activate Snipping ────────────────────────────────────────────────────
  function activateSnip() {
    if (snipActive) return;
    snipActive = true;
    ensureShadowHost();

    hostEl.style.pointerEvents = 'all';

    // Dim layer
    const dim = document.createElement('div');
    dim.className = 'sc-dim';

    // Overlay (captures mouse events)
    const overlay = document.createElement('div');
    overlay.className = 'sc-overlay';

    // Selection rect
    const selBox = document.createElement('div');
    selBox.className = 'sc-selection';

    // Size badge
    const badge = document.createElement('div');
    badge.className = 'sc-badge';

    // Hint
    const hint = document.createElement('div');
    hint.className = 'sc-hint';
    hint.innerHTML = '<span>SnapClip</span> — Click &amp; drag to capture a region &nbsp;·&nbsp; <span>ESC</span> to cancel';

    shadowRoot.appendChild(dim);
    shadowRoot.appendChild(hint);
    shadowRoot.appendChild(selBox);
    shadowRoot.appendChild(badge);
    shadowRoot.appendChild(overlay);

    let startX = 0, startY = 0;
    let isDragging = false;
    let ox = 0, oy = 0, ow = 0, oh = 0;

    function updateSel(cx, cy) {
      ox = Math.min(cx, startX);
      oy = Math.min(cy, startY);
      ow = Math.abs(cx - startX);
      oh = Math.abs(cy - startY);

      selBox.style.left = ox + 'px';
      selBox.style.top = oy + 'px';
      selBox.style.width = ow + 'px';
      selBox.style.height = oh + 'px';
      selBox.style.display = 'block';

      // Badge position
      const badgeX = ox + ow + 10;
      const badgeY = oy + oh + 8;
      badge.style.left = Math.min(badgeX, window.innerWidth - 120) + 'px';
      badge.style.top = Math.min(badgeY, window.innerHeight - 30) + 'px';
      badge.style.display = 'block';
      badge.textContent = `${Math.round(ow)} × ${Math.round(oh)}`;
    }

    overlay.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      e.preventDefault();
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateSel(e.clientX, e.clientY);
    });

    overlay.addEventListener('mouseup', async (e) => {
      if (!isDragging) return;
      isDragging = false;
      updateSel(e.clientX, e.clientY);

      if (ow < 8 || oh < 8) {
        cancelSnip(dim, overlay, selBox, badge, hint);
        return;
      }

      // Capture region
      const captureX = ox, captureY = oy, captureW = ow, captureH = oh;
      await doCapture(captureX, captureY, captureW, captureH);
      cancelSnip(dim, overlay, selBox, badge, hint);
    });

    // ESC to cancel
    const escFn = (e) => {
      if (e.key === 'Escape') {
        cancelSnip(dim, overlay, selBox, badge, hint);
        document.removeEventListener('keydown', escFn);
      }
    };
    document.addEventListener('keydown', escFn);
  }

  function cancelSnip(dim, overlay, selBox, badge, hint) {
    [dim, overlay, selBox, badge, hint].forEach(el => el && el.remove());
    snipActive = false;
    hostEl.style.pointerEvents = 'none';
  }

  // ─── Capture Region ───────────────────────────────────────────────────────
  async function doCapture(x, y, w, h) {
    const dpr = window.devicePixelRatio || 1;

    // Temporarily hide our own host element so it doesn't appear in capture
    hostEl.style.display = 'none';

    let dataURL = null;
    try {
      dataURL = await captureViaCanvas(x, y, w, h, dpr);
    } finally {
      hostEl.style.display = '';
    }

    if (!dataURL) {
      showToast('Capture failed — try a different area');
      return;
    }

    snipCount++;
    const label = `SNIP #${snipCount}  ·  ${Math.round(w)}×${Math.round(h)}`;

    // Calculate popup position (avoid clipping at screen edges)
    let posX = x + w + 18;
    let posY = y;
    const popW = Math.min(Math.max(Math.round(w * 0.8), 220), 520);
    const popH = Math.min(Math.max(Math.round(h * 0.8), 140), 420) + 38;
    if (posX + popW > window.innerWidth - 16) posX = Math.max(16, x - popW - 18);
    if (posY + popH > window.innerHeight - 16) posY = Math.max(16, window.innerHeight - popH - 16);

    // Save to background → persists across tabs
    chrome.runtime.sendMessage({
      type: 'SAVE_SNIP',
      dataURL,
      label,
      posX,
      posY,
      width: popW,
      height: popH
    });
  }

  // Native screenshot capture (bypasses cross-origin canvas tainting)
  async function captureViaCanvas(x, y, w, h, dpr) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    try {
      // Step 1: Request the background script to take a native screenshot of the viewport
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_NATIVE_SCREENSHOT' }, res => {
          if (res && res.dataUrl) resolve(res.dataUrl);
          else reject(new Error('Background capture failed'));
        });
      });

      // Step 2: Draw and crop the image onto our canvas
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Native screenshot dimensions might vary by device scaling
          const scaleX = img.width / window.innerWidth;
          const scaleY = img.height / window.innerHeight;

          ctx.drawImage(
            img,
            x * scaleX,
            y * scaleY,
            w * scaleX,
            h * scaleY,
            0,
            0,
            w,
            h
          );
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (_) { /* fallthrough */ }

    // Strategy 2: Direct screenshot-like using getDisplayMedia capture (graceful failure)
    return await captureViaGetImageData(x, y, w, h);
  }

  async function serializeDOM() {
    // Inline styles for basic elements to survive SVG foreignObject
    const clone = document.documentElement.cloneNode(true);
    // Remove scripts
    clone.querySelectorAll('script,noscript').forEach(el => el.remove());
    // Inline computed background for body
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      clone.querySelector('body').style.background = bg;
    } catch (_) { }
    return clone.outerHTML;
  }

  // Fallback: blank canvas with a descriptive placeholder
  async function captureViaGetImageData(x, y, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext('2d');

    // draw a placeholder gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0e1117');
    grad.addColorStop(1, '#141820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0,255,224,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    ctx.fillStyle = 'rgba(0,255,224,0.7)';
    ctx.font = '600 13px SF Mono, Fira Code, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Region ${Math.round(w)} × ${Math.round(h)}`, w / 2, h / 2 - 10);

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('(cross-origin page — direct capture unavailable)', w / 2, h / 2 + 14);

    return canvas.toDataURL('image/png');
  }

  // ─── Render Popup ─────────────────────────────────────────────────────────
  function renderSnip({ snipId, dataURL, label, posX, posY, width, height }) {
    ensureShadowHost();
    if (renderedSnips.has(snipId)) return; // already showing

    const popup = document.createElement('div');
    popup.className = 'sc-popup';
    popup.style.left = posX + 'px';
    popup.style.top = posY + 'px';
    popup.style.width = width + 'px';
    popup.style.height = height + 'px';

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'sc-header';

    const dot = document.createElement('div');
    dot.className = 'sc-dot';

    const lbl = document.createElement('div');
    lbl.className = 'sc-label';
    lbl.textContent = label;

    const actions = document.createElement('div');
    actions.className = 'sc-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'sc-btn copy';
    copyBtn.title = 'Copy image';
    copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4 11H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
    copyBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(dataURL);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        showToast('✓ Copied to clipboard!');
      } catch (_) {
        showToast('Copy failed — browser restriction');
      }
    });

    // Minimize / maximize button
    let minimized = false;
    const minBtn = document.createElement('button');
    minBtn.className = 'sc-btn';
    minBtn.title = 'Minimize';
    minBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    minBtn.addEventListener('click', () => {
      minimized = !minimized;
      imgWrap.style.display = minimized ? 'none' : '';
      resizeEl.style.display = minimized ? 'none' : '';
      resizeL.style.display = minimized ? 'none' : '';
      resizeR.style.display = minimized ? 'none' : '';
      resizeB.style.display = minimized ? 'none' : '';
      if (minimized) {
        popup.style.height = '36px';
        popup.style.overflow = 'hidden';
      } else {
        popup.style.height = height + 'px';
        popup.style.overflow = 'hidden';
      }
      minBtn.innerHTML = minimized
        ? `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sc-btn close';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 16 16" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    closeBtn.addEventListener('click', () => {
      popup.style.animation = 'sc-pop-in 0.18s cubic-bezier(0.55,0,1,0.45) reverse forwards';
      setTimeout(() => {
        popup.remove();
        renderedSnips.delete(snipId);
        chrome.runtime.sendMessage({ type: 'DISMISS_SNIP', snipId });
      }, 160);
    });

    actions.append(copyBtn, minBtn, closeBtn);
    header.append(dot, lbl, actions);

    // ── Image ──
    const imgWrap = document.createElement('div');
    imgWrap.className = 'sc-imgwrap';

    const img = document.createElement('img');
    img.className = 'sc-img';
    img.src = dataURL;
    img.draggable = false;
    imgWrap.appendChild(img);

    // ── Resize handles ──
    const resizeEl = document.createElement('div');
    resizeEl.className = 'sc-resize';
    const resizeL = document.createElement('div');
    resizeL.className = 'sc-resize-l';
    const resizeR = document.createElement('div');
    resizeR.className = 'sc-resize-r';
    const resizeB = document.createElement('div');
    resizeB.className = 'sc-resize-b';

    popup.append(header, imgWrap, resizeEl, resizeL, resizeR, resizeB);
    shadowRoot.appendChild(popup);
    renderedSnips.set(snipId, popup);

    // ── Drag (header) ──
    makeDraggable(popup, header);

    // ── Resize (corner SE) ──
    makeResizable(popup, resizeEl, 'se');
    makeResizable(popup, resizeL, 'w');
    makeResizable(popup, resizeR, 'e');
    makeResizable(popup, resizeB, 's');
  }

  // ─── Drag Logic ───────────────────────────────────────────────────────────
  function makeDraggable(popup, handle) {
    let dragging = false, offX = 0, offY = 0;
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      const r = popup.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      popup.style.transition = 'none';
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      let nx = e.clientX - offX;
      let ny = e.clientY - offY;
      nx = Math.max(0, Math.min(nx, window.innerWidth - 60));
      ny = Math.max(0, Math.min(ny, window.innerHeight - 36));
      popup.style.left = nx + 'px';
      popup.style.top = ny + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }

  // ─── Resize Logic ─────────────────────────────────────────────────────────
  function makeResizable(popup, handle, dir) {
    let resizing = false;
    let startX, startY, startW, startH, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = popup.offsetWidth;
      startH = popup.offsetHeight;
      startLeft = parseInt(popup.style.left) || 0;
      startTop = parseInt(popup.style.top) || 0;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (dir === 'se' || dir === 'e') {
        popup.style.width = Math.max(160, startW + dx) + 'px';
      }
      if (dir === 'se' || dir === 's') {
        popup.style.height = Math.max(100, startH + dy) + 'px';
      }
      if (dir === 'w') {
        const nw = Math.max(160, startW - dx);
        popup.style.width = nw + 'px';
        popup.style.left = (startLeft + startW - nw) + 'px';
      }
    });

    document.addEventListener('mouseup', () => { resizing = false; });
  }

  // ─── Toast Notification ───────────────────────────────────────────────────
  function showToast(msg) {
    ensureShadowHost();
    const toast = document.createElement('div');
    toast.className = 'sc-toast';
    toast.textContent = msg;
    shadowRoot.appendChild(toast);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  // ─── Remove Popup ─────────────────────────────────────────────────────────
  function removeSnip(snipId) {
    const popup = renderedSnips.get(snipId);
    if (popup) {
      popup.remove();
      renderedSnips.delete(snipId);
    }
  }

  // ─── Message Listener ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'START_SNIP') activateSnip();
    if (msg.type === 'RENDER_SNIP') renderSnip(msg);
    if (msg.type === 'REMOVE_SNIP') removeSnip(msg.snipId);
  });

  // ─── On Tab Load: Restore Existing Snips ─────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_ALL_SNIPS' }, (res) => {
    if (!res) return;
    Object.entries(res.snips || {}).forEach(([snipId, snip]) => {
      renderSnip({ snipId, ...snip });
    });
  });

})();
