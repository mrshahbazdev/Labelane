/** Geometry operations on a selection. All values in mm. */

function bounds(els) {
  const x = Math.min(...els.map((e) => e.x));
  const y = Math.min(...els.map((e) => e.y));
  const right = Math.max(...els.map((e) => e.x + e.w));
  const bottom = Math.max(...els.map((e) => e.y + e.h));
  return { x, y, right, bottom, w: right - x, h: bottom - y };
}

const round = (v) => +v.toFixed(2);

/**
 * Align a selection.
 *
 * With one element selected, align against the label itself — that is what
 * "centre this" almost always means. With several, align against the
 * selection's own bounding box.
 */
export function align(elements, ids, mode, template) {
  const sel = elements.filter((e) => ids.includes(e.id));
  if (!sel.length) return elements;

  const box = sel.length === 1
    ? { x: 0, y: 0, right: template.widthMm, bottom: template.heightMm }
    : bounds(sel);

  const move = (el) => {
    switch (mode) {
      case 'left': return { x: round(box.x) };
      case 'right': return { x: round(box.right - el.w) };
      case 'centerX': return { x: round(box.x + (box.right - box.x - el.w) / 2) };
      case 'top': return { y: round(box.y) };
      case 'bottom': return { y: round(box.bottom - el.h) };
      case 'centerY': return { y: round(box.y + (box.bottom - box.y - el.h) / 2) };
      default: return {};
    }
  };

  return elements.map((e) => (ids.includes(e.id) ? { ...e, ...move(e) } : e));
}

/** Even spacing between three or more elements. */
export function distribute(elements, ids, axis) {
  const sel = elements.filter((e) => ids.includes(e.id));
  if (sel.length < 3) return elements;

  const horizontal = axis === 'x';
  const sorted = [...sel].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = horizontal
    ? (last.x + last.w) - first.x
    : (last.y + last.h) - first.y;
  const used = sorted.reduce((sum, e) => sum + (horizontal ? e.w : e.h), 0);
  const gap = (span - used) / (sorted.length - 1);

  let cursor = horizontal ? first.x : first.y;
  const patches = new Map();

  for (const el of sorted) {
    patches.set(el.id, horizontal ? { x: round(cursor) } : { y: round(cursor) });
    cursor += (horizontal ? el.w : el.h) + gap;
  }

  return elements.map((e) => (patches.has(e.id) ? { ...e, ...patches.get(e.id) } : e));
}

/** Same width/height across the selection, using the first-selected as source. */
export function matchSize(elements, ids, axis) {
  const sel = elements.filter((e) => ids.includes(e.id));
  if (sel.length < 2) return elements;
  const src = sel[0];
  return elements.map((e) => {
    if (!ids.includes(e.id) || e.id === src.id) return e;
    return axis === 'w' ? { ...e, w: src.w } : { ...e, h: src.h };
  });
}

/** Z-order. Array position is paint order, so later means on top. */
export function reorder(elements, id, action) {
  const i = elements.findIndex((e) => e.id === id);
  if (i === -1) return elements;

  const copy = [...elements];
  const [el] = copy.splice(i, 1);

  if (action === 'front') copy.push(el);
  else if (action === 'back') copy.unshift(el);
  else if (action === 'forward') copy.splice(Math.min(copy.length, i + 1), 0, el);
  else copy.splice(Math.max(0, i - 1), 0, el);

  return copy;
}

/**
 * Snap a moving element to the label's centre lines and to the edges and
 * centres of the other elements. Returns the adjusted position plus the guides
 * to draw, so the user can see why it stopped where it did.
 */
export function computeSnap(moving, others, template, threshold = 0.7) {
  const targetsX = [0, template.widthMm / 2, template.widthMm];
  const targetsY = [0, template.heightMm / 2, template.heightMm];

  for (const o of others) {
    targetsX.push(o.x, o.x + o.w / 2, o.x + o.w);
    targetsY.push(o.y, o.y + o.h / 2, o.y + o.h);
  }

  const edgesX = [
    { value: moving.x, offset: 0 },
    { value: moving.x + moving.w / 2, offset: moving.w / 2 },
    { value: moving.x + moving.w, offset: moving.w }
  ];
  const edgesY = [
    { value: moving.y, offset: 0 },
    { value: moving.y + moving.h / 2, offset: moving.h / 2 },
    { value: moving.y + moving.h, offset: moving.h }
  ];

  let x = moving.x;
  let y = moving.y;
  const guides = [];
  let bestX = threshold;
  let bestY = threshold;

  for (const edge of edgesX) {
    for (const t of targetsX) {
      const d = Math.abs(edge.value - t);
      if (d < bestX) {
        bestX = d;
        x = round(t - edge.offset);
        guides.push({ axis: 'x', at: t });
      }
    }
  }

  for (const edge of edgesY) {
    for (const t of targetsY) {
      const d = Math.abs(edge.value - t);
      if (d < bestY) {
        bestY = d;
        y = round(t - edge.offset);
        guides.push({ axis: 'y', at: t });
      }
    }
  }

  return {
    x,
    y,
    guides: guides.filter(
      (g) =>
        (g.axis === 'x' && Math.abs(bestX) < threshold) ||
        (g.axis === 'y' && Math.abs(bestY) < threshold)
    ).slice(-2)
  };
}
