/**
 * Shrink text to fit its box.
 *
 * Variable data breaks fixed font sizes constantly — one product name is
 * "Socks" and the next is "Premium Merino Wool Crew Socks, 3 Pack". Without
 * this, one of them overflows or gets clipped, and you only find out after the
 * roll has printed.
 *
 * Measurement needs real layout, so this is browser-only. Under jsdom or any
 * other environment without layout it returns the original size unchanged
 * rather than guessing.
 */

const MM_PER_PT = 0.352778;
let probe = null;

function getProbe() {
  if (probe) return probe;
  if (typeof document === 'undefined' || !document.body) return null;

  probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    left: '-10000px',
    top: '0',
    boxSizing: 'border-box',
    overflow: 'visible'
  });
  document.body.appendChild(probe);
  return probe;
}

function fits(el, text, sizePt, scale) {
  const node = getProbe();
  if (!node) return true;

  node.style.width = `${el.w * scale}px`;
  node.style.height = 'auto';
  node.style.fontFamily = el.fontFamily || 'Arial, sans-serif';
  node.style.fontSize = `${sizePt * MM_PER_PT * scale}px`;
  node.style.fontWeight = el.bold ? '700' : '400';
  node.style.fontStyle = el.italic ? 'italic' : 'normal';
  node.style.lineHeight = String(el.lineHeight || 1.2);
  node.style.letterSpacing = `${(el.letterSpacing || 0) * scale}px`;
  node.style.whiteSpace = 'pre-wrap';
  node.style.wordBreak = 'break-word';
  node.textContent = text;

  const maxHeightPx = el.h * scale;
  return node.scrollHeight <= maxHeightPx + 0.5 && node.scrollWidth <= el.w * scale + 0.5;
}

/**
 * Largest size from the element's own font size downward that fits.
 * Binary search over quarter-point steps — a linear walk is visibly slow once
 * a run has a few hundred text elements.
 */
export function fitFontSize(el, text, { minPt = 4, scale = 4 } = {}) {
  const start = el.fontSize || 10;
  if (!text || !getProbe()) return start;
  if (fits(el, text, start, scale)) return start;

  let lo = minPt;
  let hi = start;

  for (let i = 0; i < 14 && hi - lo > 0.25; i++) {
    const mid = (lo + hi) / 2;
    if (fits(el, text, mid, scale)) lo = mid;
    else hi = mid;
  }

  return Math.max(minPt, Math.round(lo * 4) / 4);
}

export function disposeProbe() {
  if (probe?.parentNode) probe.parentNode.removeChild(probe);
  probe = null;
}
