import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { resolve, resolvesEmpty, referencedColumns } from './fields.js';
import { fitFontSize } from './textfit.js';

/**
 * Template + data row -> HTML.
 *
 * This module is the single source of truth for how a label looks. The canvas
 * preview and the printed output both go through it, so what you see on screen
 * is what comes out of the printer. Everything is laid out in millimetres, and
 * the printer is told the page is exactly that many millimetres, so there is no
 * scaling step to drift.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Placeholder resolution now lives in ./fields, which handles columns,
 * counters, dates, expressions and transforms. Re-exported here so the canvas
 * and the print path keep going through one entry point.
 */
export function bind(value, ctx) {
  // Callers used to pass a bare row; accept both shapes.
  const context = ctx && ('row' in ctx || 'index' in ctx) ? ctx : { row: ctx, index: 0 };
  return resolve(value, context);
}

export function usedColumns(elements) {
  return referencedColumns(elements);
}

/** Symbologies that bwip-js draws — the ones JsBarcode cannot. */
const BWIP_MAP = {
  DATAMATRIX: 'datamatrix',
  GS1_128: 'gs1-128',
  GS1_DATAMATRIX: 'gs1datamatrix',
  PDF417: 'pdf417',
  AZTEC: 'azteccode',
  CODE93: 'code93',
  CODABAR: 'rationalizedCodabar',
  QR_BWIP: 'qrcode'
};

export function isBwipFormat(format) {
  return Object.prototype.hasOwnProperty.call(BWIP_MAP, format);
}

/**
 * bwip-js is roughly a megabyte, and most labels only ever use Code 128 or
 * EAN-13, so it is pulled in on first use rather than at startup.
 */
let bwipPromise = null;
function loadBwip() {
  if (!bwipPromise) bwipPromise = import('bwip-js').then((m) => m.default || m);
  return bwipPromise;
}

async function bwipSVG(value, opts) {
  try {
    const bwipjs = await loadBwip();
    const svg = bwipjs.toSVG({
      bcid: BWIP_MAP[opts.format],
      text: String(value),
      scale: 3,
      includetext: opts.showValue !== false,
      textxalign: 'center',
      barcolor: (opts.lineColor || '#000000').replace('#', ''),
      parsefnc: opts.format.startsWith('GS1')
    });
    // bwip emits a fixed-size root; stretch it to the element box instead.
    return String(svg)
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, 'height="100%"')
      .replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"');
  } catch (err) {
    return placeholderSVG(String(err.message || 'barcode error').slice(0, 40));
  }
}

export async function barcodeSVG(value, opts = {}) {
  const node = document.createElementNS(SVG_NS, 'svg');
  const text = String(value ?? '').trim();

  if (!text) return placeholderSVG('no value');

  if (isBwipFormat(opts.format)) return bwipSVG(text, opts);

  // JsBarcode does not throw on a value the symbology rejects — it reports
  // through the `valid` callback and renders nothing. Without checking that
  // flag, a mistyped EAN-13 prints as a silent blank box, which is the worst
  // possible failure on a label that goes on a product.
  let valid = true;

  try {
    JsBarcode(node, text, {
      format: opts.format || 'CODE128',
      width: opts.barWidth ?? 2,
      height: opts.barHeight ?? 60,
      displayValue: opts.showValue !== false,
      fontSize: opts.fontSize ?? 16,
      textMargin: 2,
      margin: 0,
      lineColor: opts.lineColor || '#000000',
      background: 'transparent',
      valid: (isValid) => { valid = isValid; }
    });
  } catch (err) {
    return placeholderSVG(shortReason(err.message, opts.format));
  }

  if (!valid || !node.childNodes.length) {
    return placeholderSVG(`invalid ${opts.format || 'CODE128'}`);
  }

  node.setAttribute('preserveAspectRatio', 'none');
  node.setAttribute('width', '100%');
  node.setAttribute('height', '100%');
  return new XMLSerializer().serializeToString(node);
}

function shortReason(message, format) {
  if (/valid/i.test(message)) return `invalid ${format || 'barcode'}`;
  return 'barcode error';
}

function placeholderSVG(label) {
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 200 60" preserveAspectRatio="none" width="100%" height="100%">
    <rect x="0" y="0" width="200" height="60" fill="#fef2f2" stroke="#dc2626" stroke-dasharray="4 3"/>
    <text x="100" y="34" font-family="sans-serif" font-size="14" fill="#dc2626" text-anchor="middle">${escapeHtml(label)}</text>
  </svg>`;
}

export async function qrSVG(value, opts = {}) {
  const text = String(value ?? '').trim();
  if (!text) return placeholderSVG('no value');
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin: opts.margin ?? 0,
      errorCorrectionLevel: opts.ecl || 'M',
      color: { dark: opts.color || '#000000', light: '#0000' }
    });
  } catch {
    return placeholderSVG('QR error');
  }
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One element -> absolutely positioned HTML, in mm. */
export async function elementHTML(el, ctx) {
  const row = ctx?.row ?? null;

  // Hidden layers are a preview aid; they never print.
  if (el.hidden) return '';

  // "Hide when empty" stops a lone "Rs" or an empty barcode box printing when
  // the row has no value for it.
  if (el.hideIfEmpty && (el.type === 'text' || el.type === 'barcode' || el.type === 'qr')) {
    if (resolvesEmpty(el.type === 'text' ? el.text : el.value, ctx)) return '';
  }

  const base =
    `position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.w}mm;height:${el.h}mm;` +
    (el.rotate ? `transform:rotate(${el.rotate}deg);transform-origin:center center;` : '') +
    'box-sizing:border-box;overflow:hidden;';

  if (el.type === 'text') {
    const content = bind(el.text, ctx);
    const size = el.autoShrink ? fitFontSize(el, content) : (el.fontSize || 10);
    const align = el.align || 'left';
    const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    const vAlign = el.vAlign === 'middle' ? 'center' : el.vAlign === 'bottom' ? 'flex-end' : 'flex-start';
    const style = base +
      `display:flex;align-items:${vAlign};justify-content:${justify};` +
      `font-family:${el.fontFamily || 'Arial, Helvetica, sans-serif'};` +
      `font-size:${size}pt;` +
      `font-weight:${el.bold ? 700 : 400};` +
      `font-style:${el.italic ? 'italic' : 'normal'};` +
      `color:${el.color || '#000000'};` +
      `text-align:${align};line-height:${el.lineHeight || 1.2};` +
      `letter-spacing:${el.letterSpacing || 0}mm;` +
      'white-space:pre-wrap;word-break:break-word;' +
      (el.rtl ? 'direction:rtl;' : '');
    return `<div style="${style}">${escapeHtml(content)}</div>`;
  }

  if (el.type === 'barcode') {
    const svg = await barcodeSVG(bind(el.value, ctx), el);
    return `<div style="${base}display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  }

  if (el.type === 'qr') {
    const svg = await qrSVG(bind(el.value, ctx), el);
    return `<div style="${base}display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  }

  if (el.type === 'image') {
    if (!el.dataUrl) {
      return `<div style="${base}border:1px dashed #94a3b8;"></div>`;
    }
    const fit = el.fit || 'contain';
    return `<div style="${base}"><img src="${el.dataUrl}" style="width:100%;height:100%;object-fit:${fit};" /></div>`;
  }

  if (el.type === 'rect') {
    const style = base +
      `background:${el.fill || 'transparent'};` +
      `border:${el.borderWidth ?? 0.3}mm solid ${el.borderColor || '#000000'};` +
      `border-radius:${el.radius || 0}mm;`;
    return `<div style="${style}"></div>`;
  }

  if (el.type === 'line') {
    return `<div style="${base}background:${el.color || '#000000'};"></div>`;
  }

  return '';
}

/** All elements of one label, inside a fixed-size page div. */
export async function labelHTML(template, row, index = 0) {
  const ctx = { row, index };
  const parts = await Promise.all(
    (template.elements || []).map((el) => elementHTML(el, ctx))
  );
  return `<div class="label">${parts.join('')}</div>`;
}

/** Expand rows into the flat list of labels a run will produce. */
export function expandRows(template, rows, range) {
  let list = rows && rows.length ? rows : [null];

  if (range && range.mode === 'current' && rows.length) {
    list = [rows[Math.min(Math.max(0, range.index || 0), rows.length - 1)]];
  } else if (range && range.mode === 'range' && rows.length) {
    const from = Math.max(1, parseInt(range.from, 10) || 1);
    const to = Math.min(rows.length, parseInt(range.to, 10) || rows.length);
    list = rows.slice(from - 1, to);
  }

  const out = [];
  for (const row of list) {
    const copies = Math.max(
      1,
      parseInt(row?.__copies ?? template.copies ?? 1, 10) || 1
    );
    for (let i = 0; i < copies; i++) out.push(row);
  }
  return out;
}

export function countLabels(template, rows, range) {
  return expandRows(template, rows, range).length;
}

const BASE_CSS = (template) => `
  html, body { margin: 0; padding: 0; background: #fff; }
  .label {
    position: relative;
    width: ${template.widthMm}mm;
    height: ${template.heightMm}mm;
    overflow: hidden;
    background: ${template.background || '#ffffff'};
    box-sizing: border-box;
  }
  svg { display: block; }
`;

/** One label per page — the roll/thermal case. */
async function rollDocument(template, list) {
  const labels = [];
  for (let i = 0; i < list.length; i++) labels.push(await labelHTML(template, list[i], i));

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }
  ${BASE_CSS(template)}
  .label { page-break-after: always; break-after: page; }
  .label:last-child { page-break-after: auto; break-after: auto; }
</style>
</head><body>
${labels.join('\n')}
</body></html>`;
}

/**
 * Many labels per page on a grid — the A4 sheet case.
 *
 * Sheets are laid out with absolute positioning rather than flex or grid.
 * Browser grid gaps round to device pixels, and at 300dpi that rounding walks
 * the last column several millimetres off the die-cut, which ruins the sheet.
 */
async function sheetDocument(template, list) {
  const s = template.sheet;
  const perPage = Math.max(1, s.cols * s.rows);
  const pages = [];

  for (let i = 0; i < list.length; i += perPage) {
    const slice = list.slice(i, i + perPage);
    const cells = [];

    for (let j = 0; j < slice.length; j++) {
      const col = j % s.cols;
      const row = Math.floor(j / s.cols);
      const x = s.marginLeft + col * (template.widthMm + s.gapX);
      const y = s.marginTop + row * (template.heightMm + s.gapY);
      const inner = await labelHTML(template, slice[j], i + j);
      cells.push(
        `<div class="cell" style="left:${x.toFixed(3)}mm;top:${y.toFixed(3)}mm;">${inner}</div>`
      );
    }

    pages.push(`<div class="sheet">${cells.join('')}</div>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${s.pageW}mm ${s.pageH}mm; margin: 0; }
  ${BASE_CSS(template)}
  .sheet {
    position: relative;
    width: ${s.pageW}mm;
    height: ${s.pageH}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .cell { position: absolute; }
  ${s.showOutline ? '.cell { outline: 0.1mm dashed #cbd5e1; }' : ''}
</style>
</head><body>
${pages.join('\n')}
</body></html>`;
}

export async function documentHTML(template, rows, range) {
  const list = expandRows(template, rows, range);
  return template.sheet?.enabled
    ? sheetDocument(template, list)
    : rollDocument(template, list);
}

/** Page count, which is what the print dialog should actually warn about. */
export function countPages(template, rows, range) {
  const n = countLabels(template, rows, range);
  if (!template.sheet?.enabled) return n;
  const perPage = Math.max(1, template.sheet.cols * template.sheet.rows);
  return Math.ceil(n / perPage);
}

/** How many labels fit on the sheet at the current size and margins. */
export function sheetCapacity(template) {
  const s = template.sheet;
  if (!s) return { cols: 0, rows: 0, fits: false };
  const usableW = s.pageW - s.marginLeft * 2;
  const usableH = s.pageH - s.marginTop * 2;
  const maxCols = Math.floor((usableW + s.gapX) / (template.widthMm + s.gapX));
  const maxRows = Math.floor((usableH + s.gapY) / (template.heightMm + s.gapY));
  return {
    cols: Math.max(0, maxCols),
    rows: Math.max(0, maxRows),
    fits: s.cols <= maxCols && s.rows <= maxRows
  };
}
