/** Sizes people actually buy. Roll sizes first — that's what thermal users need. */
export const SIZE_PRESETS = [
  { name: '50 x 25 mm — product label', w: 50, h: 25 },
  { name: '38 x 25 mm — small product', w: 38, h: 25 },
  { name: '75 x 50 mm — large product', w: 75, h: 50 },
  { name: '100 x 150 mm — 4x6 shipping', w: 100, h: 150 },
  { name: '100 x 50 mm — address', w: 100, h: 50 },
  { name: '57 x 32 mm — price tag', w: 57, h: 32 },
  { name: '40 x 30 mm — jewellery', w: 40, h: 30 },
  { name: '100 x 75 mm — courier', w: 100, h: 75 },
  { name: '210 x 297 mm — A4 sheet', w: 210, h: 297 }
];

/**
 * A4 label sheets, measured from the common die-cut layouts sold in
 * stationery shops. Margins are the paper edge to the first label.
 */
export const SHEET_PRESETS = [
  {
    name: '24 per A4 — 63.5 x 33.9 mm',
    labelW: 63.5, labelH: 33.9,
    sheet: { pageW: 210, pageH: 297, cols: 3, rows: 8, marginLeft: 7, marginTop: 12.7, gapX: 2.5, gapY: 0 }
  },
  {
    name: '21 per A4 — 63.5 x 38.1 mm',
    labelW: 63.5, labelH: 38.1,
    sheet: { pageW: 210, pageH: 297, cols: 3, rows: 7, marginLeft: 7, marginTop: 15.1, gapX: 2.5, gapY: 0 }
  },
  {
    name: '65 per A4 — 38.1 x 21.2 mm',
    labelW: 38.1, labelH: 21.2,
    sheet: { pageW: 210, pageH: 297, cols: 5, rows: 13, marginLeft: 4.7, marginTop: 10.7, gapX: 2.5, gapY: 0 }
  },
  {
    name: '14 per A4 — 99.1 x 38.1 mm',
    labelW: 99.1, labelH: 38.1,
    sheet: { pageW: 210, pageH: 297, cols: 2, rows: 7, marginLeft: 4.7, marginTop: 15.1, gapX: 2.5, gapY: 0 }
  },
  {
    name: '8 per A4 — 99.1 x 67.7 mm',
    labelW: 99.1, labelH: 67.7,
    sheet: { pageW: 210, pageH: 297, cols: 2, rows: 4, marginLeft: 4.7, marginTop: 13.1, gapX: 2.5, gapY: 0 }
  }
];

export const DEFAULT_SHEET = {
  enabled: false,
  pageW: 210, pageH: 297,
  cols: 3, rows: 8,
  marginLeft: 7, marginTop: 12.7,
  gapX: 2.5, gapY: 0,
  showOutline: false
};

export const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'Code 128 (any text)', hint: 'Default. Letters, digits, symbols.' },
  { value: 'EAN13', label: 'EAN-13 (retail)', hint: 'Exactly 12 or 13 digits.' },
  { value: 'EAN8', label: 'EAN-8', hint: 'Exactly 7 or 8 digits.' },
  { value: 'UPC', label: 'UPC-A', hint: 'Exactly 11 or 12 digits.' },
  { value: 'CODE39', label: 'Code 39', hint: 'Uppercase, digits, - . $ / + %' },
  { value: 'ITF14', label: 'ITF-14 (cartons)', hint: 'Exactly 13 or 14 digits.' },
  { value: 'MSI', label: 'MSI', hint: 'Digits only.' },
  { value: 'pharmacode', label: 'Pharmacode', hint: 'Number between 3 and 131070.' },
  { value: 'CODE93', label: 'Code 93', hint: 'Compact alternative to Code 39.', group: '2D & GS1' },
  { value: 'CODABAR', label: 'Codabar', hint: 'Libraries, blood banks, couriers.', group: '2D & GS1' },
  { value: 'DATAMATRIX', label: 'Data Matrix', hint: 'Tiny 2D code. Electronics, pharma, small parts.', group: '2D & GS1' },
  { value: 'GS1_DATAMATRIX', label: 'GS1 Data Matrix', hint: 'Use (01)…(10)… application identifiers.', group: '2D & GS1' },
  { value: 'GS1_128', label: 'GS1-128', hint: 'Logistics. Use (00)…(01)… application identifiers.', group: '2D & GS1' },
  { value: 'PDF417', label: 'PDF417', hint: 'Holds a lot of data. IDs, shipping documents.', group: '2D & GS1' },
  { value: 'AZTEC', label: 'Aztec', hint: 'Tickets and transport passes.', group: '2D & GS1' }
];

export const FONTS = [
  'Arial, Helvetica, sans-serif',
  'Segoe UI, sans-serif',
  'Tahoma, sans-serif',
  'Verdana, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Courier New, monospace'
];

let seq = 0;
export function newId(prefix = 'el') {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

/**
 * New elements are sized in mm and deliberately land inside the label rather
 * than at 0,0 — dropping something exactly on the corner makes it look broken.
 */
export function createElement(type, template) {
  const cx = Math.max(2, template.widthMm * 0.1);
  const cy = Math.max(2, template.heightMm * 0.1);

  const common = { id: newId(type), type, x: +cx.toFixed(1), y: +cy.toFixed(1), rotate: 0 };

  switch (type) {
    case 'text':
      return {
        ...common,
        w: Math.min(template.widthMm - cx * 2, 40),
        h: 8,
        text: 'Text',
        fontSize: 10,
        fontFamily: FONTS[0],
        bold: false,
        italic: false,
        align: 'left',
        vAlign: 'middle',
        color: '#000000',
        lineHeight: 1.2,
        letterSpacing: 0,
        autoShrink: false,
        hideIfEmpty: false,
        rtl: false
      };

    case 'barcode':
      return {
        ...common,
        w: Math.min(template.widthMm - cx * 2, 45),
        h: Math.min(template.heightMm - cy * 2, 15),
        value: '{{barcode}}',
        format: 'CODE128',
        showValue: true,
        fontSize: 16,
        barWidth: 2,
        barHeight: 60,
        lineColor: '#000000',
        hideIfEmpty: false
      };

    case 'qr':
      return {
        ...common,
        w: Math.min(template.widthMm, template.heightMm) * 0.4,
        h: Math.min(template.widthMm, template.heightMm) * 0.4,
        value: '{{url}}',
        ecl: 'M',
        margin: 0,
        color: '#000000'
      };

    case 'image':
      return { ...common, w: 20, h: 20, dataUrl: '', fit: 'contain' };

    case 'rect':
      return {
        ...common,
        w: Math.min(template.widthMm - cx * 2, 30),
        h: 10,
        fill: 'transparent',
        borderColor: '#000000',
        borderWidth: 0.3,
        radius: 0
      };

    case 'line':
      return { ...common, w: Math.min(template.widthMm - cx * 2, 30), h: 0.4, color: '#000000' };

    default:
      throw new Error(`Unknown element type: ${type}`);
  }
}

export function blankTemplate(name = 'Untitled label', w = 50, h = 25) {
  return {
    id: null,
    name,
    widthMm: w,
    heightMm: h,
    background: '#ffffff',
    copies: 1,
    sheet: { ...DEFAULT_SHEET },
    elements: []
  };
}

/**
 * A starter template so a new user sees something printable immediately
 * instead of an empty rectangle.
 */
export function sampleTemplate() {
  const t = blankTemplate('Product label', 50, 25);
  t.elements = [
    {
      id: newId('text'), type: 'text', x: 3, y: 2, w: 44, h: 6, rotate: 0,
      text: '{{title}}', fontSize: 9, fontFamily: FONTS[0], bold: true,
      italic: false, align: 'left', vAlign: 'middle', color: '#000000',
      lineHeight: 1.1, letterSpacing: 0
    },
    {
      id: newId('barcode'), type: 'barcode', x: 3, y: 8.5, w: 32, h: 12, rotate: 0,
      value: '{{barcode}}', format: 'CODE128', showValue: true,
      fontSize: 14, barWidth: 2, barHeight: 60, lineColor: '#000000'
    },
    {
      id: newId('text'), type: 'text', x: 36, y: 9, w: 11, h: 7, rotate: 0,
      text: '{{price}}', fontSize: 11, fontFamily: FONTS[0], bold: true,
      italic: false, align: 'right', vAlign: 'middle', color: '#000000',
      lineHeight: 1.1, letterSpacing: 0
    },
    {
      id: newId('text'), type: 'text', x: 36, y: 16, w: 11, h: 5, rotate: 0,
      text: '{{sku}}', fontSize: 6, fontFamily: FONTS[0], bold: false,
      italic: false, align: 'right', vAlign: 'middle', color: '#475569',
      lineHeight: 1.1, letterSpacing: 0
    }
  ];
  return t;
}

export const SAMPLE_ROWS = [
  { title: 'Classic Runner UK 9', sku: 'CR-UK9', barcode: '8901234000007', price: 'Rs 7,499' },
  { title: 'Trail Grip Pro UK 8', sku: 'TGP-UK8', barcode: '8901234000106', price: 'Rs 12,499' },
  { title: 'Court Low Top UK 7', sku: 'CLT-UK7', barcode: '8901234000205', price: 'Rs 5,899' }
];
