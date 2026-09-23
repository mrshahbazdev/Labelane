/**
 * Captures Microsoft Store screenshots from the real, built app.
 *
 *   npm run build && npx electron scripts/store/screenshots.cjs
 *
 * Loads dist/ with the production preload and IPC, drives the UI with real
 * mouse events, and writes 1920x1080 PNGs to build/store/screenshots.
 * Uses a throwaway userData folder so saved templates on this machine do not
 * leak into the shots.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'build', 'store', 'screenshots');
const W = 1920;
const H = 1080;

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'labelane-shots-')));

const { registerPrintIPC } = require(path.join(ROOT, 'electron', 'ipc', 'print.cjs'));
const { registerTemplateIPC } = require(path.join(ROOT, 'electron', 'ipc', 'templates.cjs'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  registerPrintIPC();
  registerTemplateIPC();
  const { ipcMain } = require('electron');
  ipcMain.handle('app:version', () => app.getVersion());

  const win = new BrowserWindow({
    width: W, height: H, useContentSize: true, show: false, frame: false,
    webPreferences: {
      preload: path.join(ROOT, 'electron', 'preload.cjs'),
      contextIsolation: true, sandbox: true, offscreen: true
    }
  });
  win.webContents.setFrameRate(30);
  const wc = win.webContents;
  await win.loadFile(path.join(ROOT, 'dist', 'index.html'));
  await sleep(1500);

  const js = (code) => wc.executeJavaScript(code);

  /** Centre of the first element matching a DOM query expression. */
  async function centre(expr, fx = 0.5, fy = 0.5) {
    const r = await js(`(() => { const el = ${expr}; if (!el) return null;
      const b = el.getBoundingClientRect(); return { x: b.x + b.width * ${fx}, y: b.y + b.height * ${fy} }; })()`);
    if (!r) throw new Error('not found: ' + expr);
    return r;
  }

  async function click(expr, fx, fy) {
    const { x, y } = await centre(expr, fx, fy);
    const p = { x: Math.round(x), y: Math.round(y) };
    wc.sendInputEvent({ type: 'mouseMove', ...p });
    wc.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...p });
    await sleep(40);
    wc.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...p });
    await sleep(400);
  }

  const byText = (sel, text) =>
    `[...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)})`;
  const canvasElement = (i) =>
    `[...document.querySelectorAll('div')].filter((d) => d.style.cursor === 'move')[${i}]`;

  async function shot(name) {
    // Park the pointer on empty canvas so no tooltip or hover state is captured.
    wc.sendInputEvent({ type: 'mouseMove', x: 1000, y: 1000 });
    await sleep(900);
    const img = await wc.capturePage();
    const png = img.resize({ width: W, height: H, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(OUT, name), png);
    console.log('saved', name);
  }

  const key = async (keyCode) => {
    wc.sendInputEvent({ type: 'keyDown', keyCode });
    wc.sendInputEvent({ type: 'keyUp', keyCode });
    await sleep(400);
  };

  fs.mkdirSync(OUT, { recursive: true });

  // 1. Designer with sample data bound and the barcode selected.
  await click(byText('button', 'Sample'));
  await click(canvasElement(1));
  await shot('01-designer.png');

  // 2. Barcode symbology list open in the inspector.
  await click(`[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Symbology')
    ?.parentElement.querySelector('[role="combobox"]')`);
  await shot('02-barcode-symbologies.png');
  await key('Escape');

  // 3. Field reference.
  await click(byText('button', 'Fields'));
  await shot('03-dynamic-fields.png');
  await click(byText('button', 'Close'));
  await sleep(800);

  // 4. Print dialog with the live preview.
  await click(byText('button', 'Print'));
  await sleep(1500);
  await shot('04-print-preview.png');
  await click(byText('button', 'Cancel'));
  await sleep(800);

  // 5. Sheet mode for A4 label sheets.
  // Click empty canvas backdrop to deselect, so the inspector shows label setup.
  await click(`[...document.querySelectorAll('div')].find((d) => getComputedStyle(d).backgroundColor === 'rgb(226, 232, 240)')`, 0.03, 0.05);
  await click(byText('.MuiAccordionSummary-root', 'Sheet layout'));
  await sleep(500);
  await click(`[...document.querySelectorAll('label')].find((l) => l.textContent.includes('Print many per page'))`);
  await click(`[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Sheet preset')
    ?.parentElement.querySelector('[role="combobox"]')`);
  await click(`document.querySelector('[role="listbox"] [role="option"]')`);
  await shot('05-sheet-layout.png');

  // 6. Print preview of a full A4 sheet.
  await click(byText('button', 'Print'));
  await sleep(1500);
  await shot('06-sheet-print-preview.png');

  app.quit();
}).catch((err) => {
  console.error(err);
  app.exit(1);
});
