/**
 * Generates every Microsoft Store / MSIX image asset from build/logo-mark.svg.
 *
 *   npx electron scripts/store/make-assets.cjs
 *
 * Writes build/appx/* (packaged into the .appx by electron-builder) and
 * build/store/* (uploaded by hand in Partner Center). Rendering happens on a
 * canvas inside a hidden window, so output sizes are exact regardless of the
 * display's scale factor.
 */
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const APPX = path.join(ROOT, 'build', 'appx');
const STORE = path.join(ROOT, 'build', 'store');
const BG = '#0f172a';

// electron-builder maps these exact base names into the manifest; anything
// else in build/appx is copied but never referenced.
const SCALES = [100, 125, 150, 200, 400];
const TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256];

function jobs() {
  const out = [];
  const scaled = (name, w, h, spec) => {
    for (const s of SCALES) {
      out.push({ file: path.join(APPX, `${name}.scale-${s}.png`), w: Math.round(w * s / 100), h: Math.round(h * s / 100), ...spec });
    }
  };

  scaled('Square44x44Logo', 44, 44, { kind: 'mark', fill: 1 });
  scaled('StoreLogo', 50, 50, { kind: 'mark', fill: 1, bg: BG, radius: 0.18 });
  scaled('SmallTile', 71, 71, { kind: 'mark', fill: 0.8 });
  scaled('Square150x150Logo', 150, 150, { kind: 'mark', fill: 0.8 });
  scaled('LargeTile', 310, 310, { kind: 'mark', fill: 0.7 });
  scaled('Wide310x150Logo', 310, 150, { kind: 'lockup', markH: 0.44 });
  scaled('SplashScreen', 620, 300, { kind: 'lockup', markH: 0.36 });

  // Taskbar, Start and Explorer icons. Plated variants sit on BackgroundColor;
  // unplated ones are drawn as-is, so they carry their own rounded tile.
  for (const t of TARGET_SIZES) {
    out.push({ file: path.join(APPX, `Square44x44Logo.targetsize-${t}.png`), w: t, h: t, kind: 'mark', fill: 1 });
    out.push({ file: path.join(APPX, `Square44x44Logo.targetsize-${t}_altform-unplated.png`), w: t, h: t, kind: 'mark', fill: 1, bg: BG, radius: 0.2 });
    out.push({ file: path.join(APPX, `Square44x44Logo.targetsize-${t}_altform-lightunplated.png`), w: t, h: t, kind: 'mark', fill: 1, bg: BG, radius: 0.2 });
  }

  // Partner Center "Store logos" section.
  out.push({ file: path.join(STORE, 'AppTile300.png'), w: 300, h: 300, kind: 'mark', fill: 0.8, bg: BG });
  out.push({ file: path.join(STORE, 'BoxArt1080.png'), w: 1080, h: 1080, kind: 'mark', fill: 0.7, bg: BG });
  out.push({ file: path.join(STORE, 'BoxArt2160.png'), w: 2160, h: 2160, kind: 'mark', fill: 0.7, bg: BG });
  out.push({ file: path.join(STORE, 'Poster720x1080.png'), w: 720, h: 1080, kind: 'poster', bg: BG });
  out.push({ file: path.join(STORE, 'Poster1440x2160.png'), w: 1440, h: 2160, kind: 'poster', bg: BG });
  out.push({ file: path.join(STORE, 'SuperHero1920x1080.png'), w: 1920, h: 1080, kind: 'hero', bg: BG });
  out.push({ file: path.join(STORE, 'SuperHero3840x2160.png'), w: 3840, h: 2160, kind: 'hero', bg: BG });

  return out;
}

// Runs in the renderer. Kept as a string so the page needs no preload.
const RENDERER = `
async function loadMark(svg) {
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(svg);
  await img.decode();
  return img;
}

function roundRect(ctx, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
}

function drawMark(ctx, img, cx, cy, box) {
  ctx.drawImage(img, cx - box / 2, cy - box / 2, box, box);
}

function text(ctx, str, x, y, size, color, weight, align) {
  ctx.font = weight + ' ' + size + 'px "Segoe UI Variable Display", "Segoe UI", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

window.render = async (svg, j) => {
  const img = await loadMark(svg);
  const c = document.createElement('canvas');
  c.width = j.w; c.height = j.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  if (j.bg) {
    ctx.fillStyle = j.bg;
    roundRect(ctx, j.w, j.h, (j.radius || 0) * Math.min(j.w, j.h));
  }

  const s = Math.min(j.w, j.h);
  if (j.kind === 'mark') {
    drawMark(ctx, img, j.w / 2, j.h / 2, s * j.fill);
  } else if (j.kind === 'lockup') {
    // Mark + wordmark, centred as a group.
    const box = j.h * j.markH / 0.51;          // artwork is 51% of box height
    const markW = box * (181.7 / 256);
    const size = j.h * j.markH * 0.5;
    ctx.font = '700 ' + size + 'px "Segoe UI Variable Display", "Segoe UI", sans-serif';
    const tw = ctx.measureText('Labelane').width;
    const gap = size * 0.4;
    const x0 = (j.w - (markW + gap + tw)) / 2;
    ctx.drawImage(img, x0 - box * (36.8 / 256), j.h / 2 - box / 2, box, box);
    text(ctx, 'Labelane', x0 + markW + gap, j.h / 2 + size * 0.04, size, '#f8fafc', 700);
    if (x0 < j.w * 0.08) throw new Error('lockup too wide for ' + j.w + 'x' + j.h);
  } else if (j.kind === 'poster') {
    drawMark(ctx, img, j.w / 2, j.h * 0.42, j.w * 0.62);
    text(ctx, 'Labelane', j.w / 2, j.h * 0.62, j.w * 0.13, '#f8fafc', 700, 'center');
    text(ctx, 'Thermal labels & barcodes', j.w / 2, j.h * 0.69, j.w * 0.045, '#94a3b8', 600, 'center');
  } else if (j.kind === 'hero') {
    // Super hero art: keep the key content in the left two thirds, per Store
    // guidance, since the right side may be covered by the product title.
    const u = j.h / 1080;
    const grad = ctx.createRadialGradient(j.w * 0.28, j.h * 0.5, 0, j.w * 0.28, j.h * 0.5, j.w * 0.55);
    grad.addColorStop(0, 'rgba(245,158,11,0.18)');
    grad.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, j.w, j.h);
    drawMark(ctx, img, j.w * 0.28, j.h * 0.42, 560 * u);
    text(ctx, 'Labelane', j.w * 0.28, j.h * 0.70, 120 * u, '#f8fafc', 700, 'center');
    text(ctx, 'Design once. Print a whole spreadsheet of labels.', j.w * 0.28, j.h * 0.79, 40 * u, '#94a3b8', 600, 'center');
  }

  return c.toDataURL('image/png').split(',')[1];
};
0;
`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<!doctype html><meta charset=utf-8><body>');
  await win.webContents.executeJavaScript(RENDERER);

  const svg = fs.readFileSync(path.join(ROOT, 'build', 'logo-mark.svg'), 'utf8');
  fs.mkdirSync(APPX, { recursive: true });
  fs.mkdirSync(STORE, { recursive: true });

  // Old names electron-builder never referenced, and unscaled duplicates that
  // would collide with the scale-100 variants in resources.pri.
  for (const f of fs.readdirSync(APPX)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(APPX, f));
  }

  const list = jobs();
  for (const j of list) {
    const b64 = await win.webContents.executeJavaScript(
      `render(${JSON.stringify(svg)}, ${JSON.stringify(j)})`
    );
    fs.writeFileSync(j.file, Buffer.from(b64, 'base64'));
  }
  console.log(`wrote ${list.length} images`);
  app.quit();
}).catch((err) => {
  console.error(err);
  app.exit(1);
});
