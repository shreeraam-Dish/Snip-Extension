// background.js — SnapClip Service Worker

// Helper function to safely convert a Blob to base64 in a Service Worker
async function blobToDataURL(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return 'data:' + blob.type + ';base64,' + btoa(binary);
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ACTIVATE_SNIP') {
    // Inject snipping activation into the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'START_SNIP' });
    });
  }

  // Handle bare screenshot requests for cross-origin pages
  if (msg.type === 'GET_NATIVE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ dataUrl: null });
        return;
      }
      sendResponse({ dataUrl });
    });
    return true; // Keep channel open for async response
  }

  // Handle native capture & crop request (Replaces DOM Cloning)
  if (msg.type === 'CROP_CAPTURE') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'Capture failed' });
        return;
      }
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        
        const dpr = msg.dpr || 1;
        
        // Sometimes the captureVisibleTab dimensions don't perfectly match window.innerWidth * dpr
        // We calculate a scale factor between the screenshot width and the logical viewport width
        // msg.viewportW is passed from the content script.
        const viewportW = msg.viewportW || 1920;
        const scale = bitmap.width / viewportW;
        
        const cropX = msg.x * scale;
        const cropY = msg.y * scale;
        const cropW = msg.w * scale;
        const cropH = msg.h * scale;
        
        const canvas = new OffscreenCanvas(cropW, cropH);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
        const croppedDataURL = await blobToDataURL(croppedBlob);
        
        // Generate secure random ID
        const snipId = 'snip_' + Date.now() + '_' + crypto.randomUUID().split('-')[0];
        
        chrome.storage.local.set({
          [snipId]: {
            dataURL: croppedDataURL,
            label: msg.label,
            timestamp: Date.now(),
            posX: msg.posX,
            posY: msg.posY,
            width: msg.popW,
            height: msg.popH
          }
        }, () => {
          // Render the snip only in the current tab to prevent cross-tab memory leaks
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'RENDER_SNIP',
            snipId,
            dataURL: croppedDataURL,
            label: msg.label,
            posX: msg.posX,
            posY: msg.posY,
            width: msg.popW,
            height: msg.popH
          }).catch(() => {});
          
          sendResponse({ ok: true, snipId });
        });
      } catch (err) {
        console.error('Crop error:', err);
        sendResponse({ ok: false, error: err.toString() });
      }
    });

    return true; // Keep channel open for async response
  }

  // Handle manual saving (if needed)
  if (msg.type === 'SAVE_SNIP') {
    const snipId = 'snip_' + Date.now() + '_' + crypto.randomUUID().split('-')[0];
    chrome.storage.local.set({
      [snipId]: {
        dataURL: msg.dataURL,
        label: msg.label,
        timestamp: Date.now(),
        posX: msg.posX,
        posY: msg.posY,
        width: msg.width,
        height: msg.height
      }
    }, () => {
      // Just render on sender tab
      if (sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'RENDER_SNIP',
          snipId,
          dataURL: msg.dataURL,
          label: msg.label,
          posX: msg.posX,
          posY: msg.posY,
          width: msg.width,
          height: msg.height
        }).catch(() => {});
      }
      sendResponse({ ok: true, snipId });
    });
    return true;
  }

  if (msg.type === 'DISMISS_SNIP') {
    chrome.storage.local.remove(msg.snipId);
    // Broadcast dismissal to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'REMOVE_SNIP',
          snipId: msg.snipId
        }).catch(() => {});
      });
    });
  }

  if (msg.type === 'GET_ALL_SNIPS') {
    chrome.storage.local.get(null, (items) => {
      const snips = {};
      Object.entries(items).forEach(([k, v]) => {
        if (k.startsWith('snip_')) snips[k] = v;
      });
      sendResponse({ snips });
    });
    return true;
  }
});

// We REMOVED the chrome.tabs.onUpdated and chrome.tabs.onActivated listeners.
// Reason: Injecting 15-20 image data URLs into every tab whenever it activates
// completely destroys browser performance and causes massive memory leaks.
// If a user wants to review old snips, they can view them through the extension popup!
