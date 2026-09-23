const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { BrowserWindow, app } = require('electron');

const MICRONS_PER_MM = 1000;

/**
 * Takes fully-formed HTML from the renderer and puts it on paper.
 *
 * The HTML is written to a temp file and loaded with loadFile rather than a
 * data: URL. Data URLs cap out on long documents — a 500-row CSV run blows
 * straight past the limit — and they create an opaque origin that blocks
 * embedded images.
 */
async function withRenderWindow(html, fn) {
  const tmp = path.join(os.tmpdir(), `lf_${crypto.randomBytes(8).toString('hex')}.html`);
  fs.writeFileSync(tmp, html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: true
    }
  });

  try {
    await win.loadFile(tmp);
    await settle(win);
    return await fn(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try { fs.unlinkSync(tmp); } catch { /* already gone */ }
  }
}

/** Wait for fonts and images, otherwise barcodes can come out blank. */
function settle(win) {
  return win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
      const waitImages = () => {
        const imgs = Array.from(document.images).filter(i => !i.complete);
        if (!imgs.length) return done();
        let left = imgs.length;
        const tick = () => (--left <= 0) && done();
        imgs.forEach(i => { i.addEventListener('load', tick); i.addEventListener('error', tick); });
        setTimeout(done, 3000);
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(waitImages);
      else waitImages();
    })
  `).catch(() => {});
}

function pageSizeFor(widthMm, heightMm) {
  return {
    width: Math.round(widthMm * MICRONS_PER_MM),
    height: Math.round(heightMm * MICRONS_PER_MM)
  };
}

async function toPDF({ html, widthMm, heightMm, landscape = false }) {
  const buffer = await withRenderWindow(html, (win) =>
    win.webContents.printToPDF({
      printBackground: true,
      landscape,
      // The template already declares @page with exact mm, so let CSS win.
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageSize: pageSizeFor(widthMm, heightMm)
    })
  );

  const dir = path.join(app.getPath('userData'), 'output');
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, `labels_${Date.now()}.pdf`);
  fs.writeFileSync(file, buffer);
  return { success: true, filePath: file };
}

async function direct({ html, widthMm, heightMm, deviceName, copies = 1, silent = true }) {
  return withRenderWindow(html, (win) => {
    const options = {
      silent,
      printBackground: true,
      deviceName: deviceName || '',
      copies,
      margins: { marginType: 'none' },
      pageSize: pageSizeFor(widthMm, heightMm)
    };

    // The print callback fires long after this function returns, so it has to
    // be awaited inside the try block — a `finally` that closes the window
    // would run first and kill the job mid-flight.
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Print timed out after 60s. Check that the printer is online.')),
        60000
      );

      win.webContents.print(options, (ok, errorType) => {
        clearTimeout(timer);
        if (ok) return resolve({ success: true });
        if (errorType === 'cancelled') return resolve({ success: false, cancelled: true });
        reject(new Error(`Print failed: ${errorType}`));
      });
    });
  });
}

module.exports = { toPDF, direct };
