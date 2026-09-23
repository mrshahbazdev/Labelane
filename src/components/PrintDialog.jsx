import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Stack, Alert, Box, ToggleButton, ToggleButtonGroup, Typography,
  CircularProgress, IconButton
} from '@mui/material';
import { Print, PictureAsPdf, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { documentHTML, countLabels, countPages, sheetCapacity } from '../lib/labelHtml';

/**
 * Print dialog.
 *
 * The preview renders the real print HTML in an iframe, so it catches the
 * things that only show up on paper — an element clipped at the edge, a
 * barcode that failed to encode, a placeholder that never got a column.
 * Cheaper to notice here than after 300 labels have come off the roll.
 */
export default function PrintDialog({ open, onClose, template, rows, previewIndex, onNotify }) {
  const [printers, setPrinters] = useState([]);
  const [printer, setPrinter] = useState('');
  const [mode, setMode] = useState('all');
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [busy, setBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [page, setPage] = useState(0);
  const [building, setBuilding] = useState(false);

  const range = { mode, index: previewIndex, from, to };
  const labels = countLabels(template, rows, range);
  const pages = countPages(template, rows, range);
  const capacity = template.sheet?.enabled ? sheetCapacity(template) : null;

  useEffect(() => {
    if (!open) return;
    setTo(rows.length || 1);
    window.api.print.listPrinters()
      .then((list) => {
        setPrinters(list);
        setPrinter((list.find((p) => p.isDefault) || list[0])?.name || '');
      })
      .catch(() => setPrinters([]));
  }, [open, rows.length]);

  // Build a small preview only — rendering 2,000 labels into an iframe would
  // lock the window for the sake of a thumbnail.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBuilding(true);

    const previewRows = rows.length ? rows.slice(0, 12) : [];
    documentHTML(template, previewRows, mode === 'current' ? range : { mode: 'all' })
      .then((html) => { if (alive) { setPreviewHtml(html); setPage(0); } })
      .finally(() => { if (alive) setBuilding(false); });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template, rows, mode, previewIndex]);

  const run = async (target) => {
    setBusy(true);
    try {
      const html = await documentHTML(template, rows, range);
      const payload = template.sheet?.enabled
        ? { html, widthMm: template.sheet.pageW, heightMm: template.sheet.pageH }
        : { html, widthMm: template.widthMm, heightMm: template.heightMm };

      if (target === 'pdf') {
        const res = await window.api.print.toPDF(payload);
        onNotify(`PDF saved to ${res.filePath}`);
      } else {
        const res = await window.api.print.direct({ ...payload, deviceName: printer });
        if (res.cancelled) onNotify('Print cancelled', 'info');
        else onNotify(`Sent ${labels} label${labels === 1 ? '' : 's'} to ${printer}`);
      }
      onClose();
    } catch (err) {
      onNotify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>Print labels</DialogTitle>

      <DialogContent>
        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          <Stack spacing={2} sx={{ width: 300 }}>
            <ToggleButtonGroup
              size="small" exclusive value={mode} fullWidth
              onChange={(_e, v) => v && setMode(v)}
            >
              <ToggleButton value="all">All rows</ToggleButton>
              <ToggleButton value="current" disabled={!rows.length}>Current</ToggleButton>
              <ToggleButton value="range" disabled={!rows.length}>Range</ToggleButton>
            </ToggleButtonGroup>

            {mode === 'range' && (
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" label="From" type="number" value={from}
                  onChange={(e) => setFrom(Math.max(1, Number(e.target.value) || 1))}
                />
                <TextField
                  size="small" label="To" type="number" value={to}
                  onChange={(e) => setTo(Math.min(rows.length, Number(e.target.value) || rows.length))}
                />
              </Stack>
            )}

            <TextField
              select size="small" label="Printer" value={printer}
              onChange={(e) => setPrinter(e.target.value)}
              helperText={
                printers.length
                  ? 'Set the same label size in the printer driver'
                  : 'No printers detected — you can still save a PDF'
              }
            >
              {printers.map((p) => (
                <MenuItem key={p.name} value={p.name}>
                  {p.displayName}{p.isDefault ? ' (default)' : ''}
                </MenuItem>
              ))}
            </TextField>

            <Alert severity={labels > 300 ? 'warning' : 'info'}>
              {labels.toLocaleString()} label{labels === 1 ? '' : 's'} over{' '}
              {pages.toLocaleString()} page{pages === 1 ? '' : 's'}
              {labels > 300 && '. Long run — check the roll has enough stock.'}
            </Alert>

            {capacity && !capacity.fits && (
              <Alert severity="error">
                The grid does not fit the page. At this label size and margin,
                only {capacity.cols} × {capacity.rows} fit. Labels past that edge
                will be cut off.
              </Alert>
            )}
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Preview</Typography>
              <Stack direction="row" alignItems="center">
                <IconButton size="small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <NavigateBefore fontSize="small" />
                </IconButton>
                <Typography variant="caption">Page {page + 1}</Typography>
                <IconButton size="small" onClick={() => setPage((p) => p + 1)}>
                  <NavigateNext fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Box sx={{
              height: 340, bgcolor: '#e2e8f0', borderRadius: 1,
              display: 'flex', alignItems: building ? 'center' : 'flex-start', justifyContent: 'center',
              overflow: 'hidden', position: 'relative'
            }}>
              {building ? (
                <CircularProgress size={24} />
              ) : (
                <iframe
                  title="print preview"
                  srcDoc={previewHtml}
                  sandbox=""
                  style={{
                    border: 'none',
                    background: '#fff',
                    // A4 is 794 CSS px wide. flexShrink stops the row squeezing the
                    // iframe to the box width, which clipped the right-hand columns.
                    width: 800,
                    flexShrink: 0,
                    height: 1000,
                    transform: `scale(0.34) translateY(${-page * 1000}px)`,
                    transformOrigin: 'top center'
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Scaled preview of the first few labels, rendered from the same HTML that prints.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button startIcon={<PictureAsPdf />} onClick={() => run('pdf')} disabled={busy}>
          Save PDF
        </Button>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Print />}
          onClick={() => run('direct')}
          disabled={busy || !printer}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}
