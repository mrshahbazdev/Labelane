import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { bind, barcodeSVG, qrSVG } from '../lib/labelHtml';
import { computeSnap } from '../lib/arrange.js';

const MIN_SIZE = 2;      // mm
const round = (v) => +v.toFixed(2);

function CodePreview({ el, row }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let alive = true;
    const value = bind(el.value, row);
    const render = el.type === 'barcode' ? barcodeSVG(value, el) : qrSVG(value, el);
    render.then((s) => { if (alive) setSvg(s); });
    return () => { alive = false; };
  }, [
    el.type, el.value, el.format, el.showValue, el.fontSize, el.barWidth,
    el.barHeight, el.lineColor, el.ecl, el.margin, el.color, row
  ]);

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function ElementView({ el, row }) {
  if (el.type === 'text') {
    const align = el.align || 'left';
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: el.vAlign === 'middle' ? 'center' : el.vAlign === 'bottom' ? 'flex-end' : 'flex-start',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        fontFamily: el.fontFamily || 'Arial, sans-serif',
        fontSize: `${el.fontSize || 10}pt`,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? 'italic' : 'normal',
        color: el.color || '#000',
        textAlign: align,
        lineHeight: el.lineHeight || 1.2,
        letterSpacing: `${el.letterSpacing || 0}mm`,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden'
      }}>
        {bind(el.text, row)}
      </div>
    );
  }

  if (el.type === 'barcode' || el.type === 'qr') return <CodePreview el={el} row={row} />;

  if (el.type === 'image') {
    if (!el.dataUrl) {
      return (
        <div style={{
          width: '100%', height: '100%', border: '1px dashed #94a3b8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#94a3b8'
        }}>image</div>
      );
    }
    return <img src={el.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain' }} />;
  }

  if (el.type === 'rect') {
    return <div style={{
      width: '100%', height: '100%',
      background: el.fill || 'transparent',
      border: `${el.borderWidth ?? 0.3}mm solid ${el.borderColor || '#000'}`,
      borderRadius: `${el.radius || 0}mm`,
      boxSizing: 'border-box'
    }} />;
  }

  if (el.type === 'line') {
    return <div style={{ width: '100%', height: '100%', background: el.color || '#000' }} />;
  }

  return null;
}

const HANDLES = [
  { key: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { key: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { key: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { key: 'se', x: 1, y: 1, cursor: 'nwse-resize' }
];

export default function Canvas({
  template, selectedIds, onSelect, onPatchMany, previewRow, zoom, showGrid
}) {
  const dragRef = useRef(null);
  const surfaceRef = useRef(null);
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null);

  const px = zoom;
  const toMm = useCallback((v) => v / px, [px]);

  const beginDrag = (e, el, mode, handle) => {
    e.stopPropagation();
    e.preventDefault();

    const ids = selectedIds.includes(el.id)
      ? selectedIds
      : (e.shiftKey ? [...selectedIds, el.id] : [el.id]);
    onSelect(ids);

    dragRef.current = {
      mode,
      handle,
      ids,
      startX: e.clientX,
      startY: e.clientY,
      originals: template.elements
        .filter((x) => ids.includes(x.id))
        .map((x) => ({ id: x.id, x: x.x, y: x.y, w: x.w, h: x.h }))
    };
  };

  const beginMarquee = (e) => {
    if (e.target !== surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    dragRef.current = {
      mode: 'marquee',
      originX: e.clientX - rect.left,
      originY: e.clientY - rect.top,
      rect
    };
    setMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 });
    if (!e.shiftKey) onSelect([]);
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;

      if (d.mode === 'marquee') {
        const cx = e.clientX - d.rect.left;
        const cy = e.clientY - d.rect.top;
        setMarquee({
          x: Math.min(d.originX, cx),
          y: Math.min(d.originY, cy),
          w: Math.abs(cx - d.originX),
          h: Math.abs(cy - d.originY)
        });
        return;
      }

      const dx = toMm(e.clientX - d.startX);
      const dy = toMm(e.clientY - d.startY);

      if (d.mode === 'move') {
        // Snapping is only applied to a single element. Snapping a whole group
        // to several targets at once fights the user rather than helping.
        if (d.ids.length === 1) {
          const o = d.originals[0];
          const others = template.elements.filter((x) => x.id !== o.id);
          const raw = { ...o, x: o.x + dx, y: o.y + dy };
          const snapped = e.altKey
            ? { x: round(raw.x), y: round(raw.y), guides: [] }
            : computeSnap(raw, others, template);

          onPatchMany([{
            id: o.id,
            patch: {
              x: Math.max(0, Math.min(template.widthMm - o.w, snapped.x)),
              y: Math.max(0, Math.min(template.heightMm - o.h, snapped.y))
            }
          }], 'move');
          setGuides(snapped.guides);
        } else {
          onPatchMany(
            d.originals.map((o) => ({
              id: o.id,
              patch: {
                x: Math.max(0, Math.min(template.widthMm - o.w, round(o.x + dx))),
                y: Math.max(0, Math.min(template.heightMm - o.h, round(o.y + dy)))
              }
            })),
            'move'
          );
        }
        return;
      }

      // Resize: the grabbed corner stays put and the opposite corner moves.
      const o = d.originals[0];
      const h = d.handle || 'se';
      let x = o.x;
      let y = o.y;
      let w = o.w;
      let ht = o.h;

      if (h.includes('e')) w = o.w + dx;
      if (h.includes('s')) ht = o.h + dy;
      if (h.includes('w')) { w = o.w - dx; x = o.x + dx; }
      if (h.includes('n')) { ht = o.h - dy; y = o.y + dy; }

      if (e.shiftKey && o.w > 0) ht = (o.h / o.w) * w;   // hold ratio

      w = Math.max(MIN_SIZE, w);
      ht = Math.max(MIN_SIZE, ht);

      onPatchMany([{
        id: o.id,
        patch: { x: round(Math.max(0, x)), y: round(Math.max(0, y)), w: round(w), h: round(ht) }
      }], 'resize');
    };

    const onUp = () => {
      const d = dragRef.current;

      if (d?.mode === 'marquee' && marquee) {
        const hit = template.elements.filter((el) => {
          const ex = el.x * px;
          const ey = el.y * px;
          return ex < marquee.x + marquee.w && ex + el.w * px > marquee.x &&
                 ey < marquee.y + marquee.h && ey + el.h * px > marquee.y;
        }).map((el) => el.id);
        if (hit.length) onSelect(hit);
      }

      dragRef.current = null;
      setGuides([]);
      setMarquee(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [template, onPatchMany, onSelect, toMm, marquee, px]);

  const sheet = template.sheet?.enabled ? template.sheet : null;

  return (
    <Box
      sx={{
        flex: 1, overflow: 'auto', bgcolor: '#e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4
      }}
      onMouseDown={() => onSelect([])}
    >
      <Box sx={{ position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
        {sheet && (
          <Box sx={{ mb: 1, fontSize: 12, color: '#475569', textAlign: 'center' }}>
            Sheet mode · {sheet.cols} × {sheet.rows} per {sheet.pageW} × {sheet.pageH} mm page
          </Box>
        )}

        <Box
          ref={surfaceRef}
          onMouseDown={beginMarquee}
          sx={{
            position: 'relative',
            width: template.widthMm * px,
            height: template.heightMm * px,
            background: template.background || '#fff',
            backgroundImage: showGrid
              ? 'linear-gradient(#eef2f7 1px, transparent 1px), linear-gradient(90deg, #eef2f7 1px, transparent 1px)'
              : 'none',
            backgroundSize: showGrid ? `${5 * px}px ${5 * px}px` : undefined,
            boxShadow: '0 8px 30px rgba(15,23,42,0.25)',
            outline: '1px solid #cbd5e1',
            flexShrink: 0
          }}
        >
          {(template.elements || []).map((el) => {
            const selected = selectedIds.includes(el.id);
            return (
              <div
                key={el.id}
                onMouseDown={(e) => { if (!el.locked) beginDrag(e, el, 'move'); }}
                style={{
                  position: 'absolute',
                  left: el.x * px, top: el.y * px,
                  width: el.w * px, height: el.h * px,
                  transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
                  transformOrigin: 'center center',
                  cursor: el.locked ? 'default' : 'move',
                  opacity: el.hidden ? 0.2 : 1,
                  outline: selected ? '2px solid #2563eb' : '1px dashed rgba(100,116,139,0.4)',
                  boxSizing: 'border-box'
                }}
              >
                <ElementView el={el} row={previewRow} />

                {selected && selectedIds.length === 1 && !el.locked && HANDLES.map((h) => (
                  <div
                    key={h.key}
                    onMouseDown={(e) => beginDrag(e, el, 'resize', h.key)}
                    style={{
                      position: 'absolute',
                      left: h.x ? undefined : -5,
                      right: h.x ? -5 : undefined,
                      top: h.y ? undefined : -5,
                      bottom: h.y ? -5 : undefined,
                      width: 10, height: 10,
                      background: '#2563eb', border: '2px solid #fff',
                      borderRadius: 2, cursor: h.cursor
                    }}
                  />
                ))}
              </div>
            );
          })}

          {guides.map((g, i) => (
            <div
              key={i}
              style={g.axis === 'x'
                ? { position: 'absolute', left: g.at * px, top: 0, bottom: 0, width: 1, background: '#f43f5e', pointerEvents: 'none' }
                : { position: 'absolute', top: g.at * px, left: 0, right: 0, height: 1, background: '#f43f5e', pointerEvents: 'none' }}
            />
          ))}

          {marquee && (
            <div style={{
              position: 'absolute',
              left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h,
              background: 'rgba(37,99,235,0.12)', border: '1px solid #2563eb',
              pointerEvents: 'none'
            }} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
