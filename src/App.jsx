import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Stack, Tooltip,
  Snackbar, Alert, Drawer, List, ListItemButton, ListItemText, Divider,
  Slider, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import {
  TextFields, QrCode, ViewWeek, Image as ImageIcon, CropSquare, Remove,
  Print, Save, FolderOpen, Add, Delete, ContentCopy, ZoomIn,
  Undo, Redo, GridOn, Keyboard
} from '@mui/icons-material';

import Canvas from './components/Canvas';
import Inspector from './components/Inspector';
import DataPanel from './components/DataPanel';
import LayersPanel from './components/LayersPanel';
import PrintDialog from './components/PrintDialog';
import { createElement, blankTemplate, sampleTemplate, newId, DEFAULT_SHEET } from './lib/model';
import { countLabels } from './lib/labelHtml';
import { align, distribute, reorder } from './lib/arrange';
import { useHistory } from './lib/history';

const TOOLS = [
  { type: 'text', icon: <TextFields />, label: 'Text' },
  { type: 'barcode', icon: <ViewWeek />, label: 'Barcode' },
  { type: 'qr', icon: <QrCode />, label: 'QR code' },
  { type: 'image', icon: <ImageIcon />, label: 'Image' },
  { type: 'rect', icon: <CropSquare />, label: 'Box' },
  { type: 'line', icon: <Remove />, label: 'Line' }
];

const SHORTCUTS = [
  ['Ctrl + Z / Ctrl + Y', 'Undo / redo'],
  ['Ctrl + S', 'Save template'],
  ['Ctrl + P', 'Print'],
  ['Ctrl + D', 'Duplicate selection'],
  ['Ctrl + C / Ctrl + V', 'Copy / paste'],
  ['Ctrl + A', 'Select everything'],
  ['Delete', 'Remove selection'],
  ['Arrow keys', 'Nudge 0.5 mm (2 mm with Shift)'],
  ['Shift + click', 'Add to selection'],
  ['Drag on empty space', 'Marquee select'],
  ['Alt while dragging', 'Ignore snapping'],
  ['Shift while resizing', 'Keep aspect ratio']
];

export default function App() {
  const {
    state: template, commit, reset, undo, redo, canUndo, canRedo
  } = useHistory(() => sampleTemplate());

  const [selectedIds, setSelectedIds] = useState([]);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [zoom, setZoom] = useState(6);
  const [showGrid, setShowGrid] = useState(false);
  const [toast, setToast] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const clipboard = useRef([]);

  const selection = useMemo(
    () => (template.elements || []).filter((e) => selectedIds.includes(e.id)),
    [template.elements, selectedIds]
  );

  const previewRow = rows.length ? rows[Math.min(previewIndex, rows.length - 1)] : null;
  const notify = useCallback((message, severity = 'success') => setToast({ message, severity }), []);

  // Refit when the label size changes so switching presets doesn't leave the
  // label off-screen or microscopic.
  useEffect(() => {
    const fitW = (window.innerWidth - 760) / template.widthMm;
    const fitH = (window.innerHeight - 220) / template.heightMm;
    setZoom(Math.max(1.5, Math.min(14, Math.min(fitW, fitH))));
  }, [template.widthMm, template.heightMm]);

  const patchTemplate = useCallback(
    (patch) => commit((t) => ({ ...t, ...patch }), 'template'),
    [commit]
  );

  const patchElement = useCallback((id, patch) => {
    commit(
      (t) => ({ ...t, elements: t.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
      `el:${id}:${Object.keys(patch).join(',')}`
    );
  }, [commit]);

  /** Batched patches from a drag — one history entry for the whole gesture. */
  const patchMany = useCallback((updates, label) => {
    commit((t) => {
      const map = new Map(updates.map((u) => [u.id, u.patch]));
      return { ...t, elements: t.elements.map((e) => (map.has(e.id) ? { ...e, ...map.get(e.id) } : e)) };
    }, label || 'drag');
  }, [commit]);

  const addElement = useCallback((type) => {
    commit((t) => {
      const el = createElement(type, t);
      setSelectedIds([el.id]);
      return { ...t, elements: [...t.elements, el] };
    }, null);
  }, [commit]);

  const deleteElements = useCallback((ids) => {
    commit((t) => ({ ...t, elements: t.elements.filter((e) => !ids.includes(e.id)) }), null);
    setSelectedIds([]);
  }, [commit]);

  const duplicateElements = useCallback((ids) => {
    commit((t) => {
      const copies = t.elements
        .filter((e) => ids.includes(e.id))
        .map((e) => ({ ...e, id: newId(e.type), x: e.x + 2, y: e.y + 2 }));
      setSelectedIds(copies.map((c) => c.id));
      return { ...t, elements: [...t.elements, ...copies] };
    }, null);
  }, [commit]);

  const doAlign = useCallback((mode) => {
    commit((t) => ({ ...t, elements: align(t.elements, selectedIds, mode, t) }), null);
  }, [commit, selectedIds]);

  const doDistribute = useCallback((axis) => {
    commit((t) => ({ ...t, elements: distribute(t.elements, selectedIds, axis) }), null);
  }, [commit, selectedIds]);

  const doReorder = useCallback((id, action) => {
    commit((t) => ({ ...t, elements: reorder(t.elements, id, action) }), null);
  }, [commit]);

  const refreshLibrary = useCallback(async () => setLibrary(await window.api.templates.list()), []);

  const saveTemplate = useCallback(async () => {
    try {
      const saved = await window.api.templates.save(template);
      reset(saved);
      notify('Template saved');
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [template, reset, notify]);

  // Keyboard. Skipped while typing in a field, otherwise Delete in a text box
  // would wipe the element the user is editing.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault(); redo(); return;
      }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveTemplate(); return; }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); setPrintOpen(true); return; }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(template.elements.map((el) => el.id));
        return;
      }
      if (mod && e.key.toLowerCase() === 'd' && selectedIds.length) {
        e.preventDefault(); duplicateElements(selectedIds); return;
      }
      if (mod && e.key.toLowerCase() === 'c' && selection.length) {
        clipboard.current = selection.map((el) => ({ ...el }));
        notify(`${selection.length} element${selection.length === 1 ? '' : 's'} copied`, 'info');
        return;
      }
      if (mod && e.key.toLowerCase() === 'v' && clipboard.current.length) {
        e.preventDefault();
        commit((t) => {
          const pasted = clipboard.current.map((el) => ({
            ...el, id: newId(el.type), x: el.x + 3, y: el.y + 3
          }));
          setSelectedIds(pasted.map((p) => p.id));
          return { ...t, elements: [...t.elements, ...pasted] };
        }, null);
        return;
      }

      if (!selectedIds.length) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); deleteElements(selectedIds); return;
      }

      const step = e.shiftKey ? 2 : 0.5;
      const delta = {
        ArrowLeft: { dx: -step, dy: 0 },
        ArrowRight: { dx: step, dy: 0 },
        ArrowUp: { dx: 0, dy: -step },
        ArrowDown: { dx: 0, dy: step }
      }[e.key];

      if (delta) {
        e.preventDefault();
        patchMany(
          selection.map((el) => ({
            id: el.id,
            patch: {
              x: +Math.max(0, Math.min(template.widthMm - el.w, el.x + delta.dx)).toFixed(2),
              y: +Math.max(0, Math.min(template.heightMm - el.h, el.y + delta.dy)).toFixed(2)
            }
          })),
          'nudge'
        );
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedIds, selection, template, undo, redo, saveTemplate,
    duplicateElements, deleteElements, patchMany, commit, notify
  ]);

  const total = countLabels(template, rows);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#0f172a' }}>
        <Toolbar variant="dense" sx={{ gap: 0.5 }}>
          <Typography sx={{ fontWeight: 800, mr: 2 }}>Labelane</Typography>

          {TOOLS.map((t) => (
            <Tooltip key={t.type} title={`Add ${t.label.toLowerCase()}`}>
              <IconButton size="small" sx={{ color: '#cbd5e1' }} onClick={() => addElement(t.type)}>
                {t.icon}
              </IconButton>
            </Tooltip>
          ))}

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#334155' }} />

          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton size="small" sx={{ color: '#cbd5e1' }} onClick={undo} disabled={!canUndo}>
                <Undo />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton size="small" sx={{ color: '#cbd5e1' }} onClick={redo} disabled={!canRedo}>
                <Redo />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="5 mm grid">
            <IconButton
              size="small"
              sx={{ color: showGrid ? '#38bdf8' : '#cbd5e1' }}
              onClick={() => setShowGrid((v) => !v)}
            >
              <GridOn />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#334155' }} />

          <Tooltip title="New label">
            <IconButton size="small" sx={{ color: '#cbd5e1' }}
              onClick={() => { reset(blankTemplate()); setSelectedIds([]); }}>
              <Add />
            </IconButton>
          </Tooltip>
          <Tooltip title="Saved templates">
            <IconButton size="small" sx={{ color: '#cbd5e1' }}
              onClick={async () => { await refreshLibrary(); setLibraryOpen(true); }}>
              <FolderOpen />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save (Ctrl+S)">
            <IconButton size="small" sx={{ color: '#cbd5e1' }} onClick={saveTemplate}>
              <Save />
            </IconButton>
          </Tooltip>
          <Tooltip title="Keyboard shortcuts">
            <IconButton size="small" sx={{ color: '#cbd5e1' }} onClick={() => setHelpOpen(true)}>
              <Keyboard />
            </IconButton>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <Typography variant="body2" sx={{ color: '#94a3b8', mr: 1 }}>
            {template.name}
          </Typography>

          <ZoomIn fontSize="small" sx={{ color: '#64748b' }} />
          <Slider size="small" value={zoom} min={1.5} max={16} step={0.5}
            onChange={(_e, v) => setZoom(v)} sx={{ width: 100, color: '#38bdf8', mx: 1 }} />

          <Chip size="small" label={`${total.toLocaleString()} label${total === 1 ? '' : 's'}`}
            sx={{ bgcolor: '#1e293b', color: '#e2e8f0', mr: 1 }} />

          <Button variant="contained" size="small" startIcon={<Print />} onClick={() => setPrintOpen(true)}>
            Print
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ width: 340, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <DataPanel
              rows={rows}
              columns={columns}
              elements={template.elements}
              previewIndex={previewIndex}
              onPreviewIndex={setPreviewIndex}
              onData={(r, c) => { setRows(r); setColumns(c); }}
            />
          </Box>
          <LayersPanel
            elements={template.elements}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onPatch={patchElement}
            onReorder={doReorder}
          />
        </Box>

        <Canvas
          template={template}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onPatchMany={patchMany}
          previewRow={previewRow}
          zoom={zoom}
          showGrid={showGrid}
        />

        <Inspector
          template={template}
          selection={selection}
          onTemplate={patchTemplate}
          onElement={patchElement}
          onDelete={(id) => deleteElements([id])}
          onDuplicate={(id) => duplicateElements([id])}
          onAlign={doAlign}
          onDistribute={doDistribute}
        />
      </Box>

      <PrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        template={template}
        rows={rows}
        previewIndex={previewIndex}
        onNotify={notify}
      />

      <Drawer anchor="left" open={libraryOpen} onClose={() => setLibraryOpen(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Saved templates</Typography>
          {library.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nothing saved yet. Design a label and press Ctrl+S.
            </Typography>
          )}
          <List dense>
            {library.map((t) => (
              <ListItemButton
                key={t.id}
                onClick={async () => {
                  const loaded = await window.api.templates.load(t.id);
                  reset({ sheet: { ...DEFAULT_SHEET }, ...loaded });
                  setSelectedIds([]);
                  setLibraryOpen(false);
                }}
              >
                <ListItemText
                  primary={t.name}
                  secondary={`${t.widthMm} × ${t.heightMm} mm · ${t.elementCount} elements`}
                />
                <IconButton size="small" onClick={async (e) => {
                  e.stopPropagation();
                  await window.api.templates.duplicate(t.id);
                  await refreshLibrary();
                }}>
                  <ContentCopy fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={async (e) => {
                  e.stopPropagation();
                  await window.api.templates.remove(t.id);
                  await refreshLibrary();
                }}>
                  <Delete fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogContent>
          <Stack spacing={0.5}>
            {SHORTCUTS.map(([keys, what]) => (
              <Stack key={keys} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#334155' }}>{keys}</Typography>
                <Typography variant="body2" color="text.secondary">{what}</Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth size="small" sx={{ mt: 1 }}
            value={template.name}
            onChange={(e) => patchTemplate({ name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast && (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
