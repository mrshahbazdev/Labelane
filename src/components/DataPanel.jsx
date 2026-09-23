import React, { useState } from 'react';
import {
  Box, Typography, Button, Stack, Chip, Table, TableHead, TableRow,
  TableCell, TableBody, IconButton, Alert, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { UploadFile, Clear, Visibility, Science, Functions } from '@mui/icons-material';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { usedColumns } from '../lib/labelHtml';
import { SAMPLE_ROWS } from '../lib/model';

const FIELD_REFERENCE = [
  {
    title: 'Counters and dates',
    items: [
      ['{{serial}}', 'increments once per label'],
      ['{{serial:start=1000,pad=5}}', 'starts at 1000, zero-padded'],
      ['{{serial:prefix=INV-,pad=4}}', 'INV-0001, INV-0002 …'],
      ['{{row}}', 'label number in the run'],
      ['{{date}}', "today's date"],
      ['{{date:+180}}', '180 days out — expiry dates'],
      ['{{date:format=YYYY-MM-DD}}', 'custom date format'],
      ['{{time}}', 'current time']
    ]
  },
  {
    title: 'Maths',
    items: [
      ['{{= price * 1.17 }}', 'add tax'],
      ['{{= [unit price] * [qty] }}', 'use [] for names with spaces'],
      ['{{= (cost + 50) * 2 }}', 'brackets and precedence work']
    ]
  },
  {
    title: 'Transforms — chain with |',
    items: [
      ['{{title|upper}}', 'UPPERCASE'],
      ['{{title|truncate:20}}', 'shorten with an ellipsis'],
      ['{{price|money:Rs}}', 'Rs 7,499.00'],
      ['{{sku|pad:8}}', 'zero-pad'],
      ['{{note|default:N/A}}', 'fallback when blank'],
      ['{{= price * 1.17 |money:Rs}}', 'maths then formatting']
    ]
  }
];

export default function DataPanel({ rows, columns, onData, previewIndex, onPreviewIndex, elements }) {
  const [error, setError] = useState(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);

  const needed = usedColumns(elements || []);
  const missing = needed.filter(
    (n) => !columns.some((c) => c.toLowerCase() === n.toLowerCase())
  );

  const loadData = async () => {
    setError(null);
    // Excel first in the filter list — merchants keep their catalogues in
    // .xlsx, and "save as CSV" is where most of them give up.
    const file = await window.api.app.openFile({
      filters: [{ name: 'Spreadsheets and data', extensions: ['xlsx', 'xls', 'csv', 'tsv', 'txt'] }]
    });
    if (!file) return;

    if (file.base64) {
      try {
        const wb = XLSX.read(file.base64, { type: 'base64' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        if (!data.length) { setError('That sheet has no data rows.'); return; }
        onData(data, Object.keys(data[0]));
        onPreviewIndex(0);
        if (wb.SheetNames.length > 1) {
          setError(`Loaded the first sheet, "${wb.SheetNames[0]}". The file has ${wb.SheetNames.length} sheets.`);
        }
      } catch (err) {
        setError(`Could not read that spreadsheet: ${err.message}`);
      }
      return;
    }

    if (!file.text) return;

    const parsed = Papa.parse(file.text.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    if (parsed.errors?.length) {
      // One malformed row shouldn't throw away a 2,000-row file.
      setError(`${parsed.errors.length} row(s) could not be read and were skipped.`);
    }
    if (!parsed.data.length) {
      setError('That file has no data rows.');
      return;
    }

    onData(parsed.data, parsed.meta.fields || Object.keys(parsed.data[0]));
    onPreviewIndex(0);
  };

  return (
    <Box sx={{ width: 340, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Data</Typography>

        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" startIcon={<UploadFile />} onClick={loadData}>
            Load data
          </Button>
          <Tooltip title="Field reference">
            <Button size="small" variant="outlined" startIcon={<Functions />} onClick={() => setFieldsOpen(true)}>
              Fields
            </Button>
          </Tooltip>
          <Tooltip title="Load a few sample rows to try the template">
            <Button
              size="small" variant="outlined" startIcon={<Science />}
              onClick={() => {
                onData(SAMPLE_ROWS, Object.keys(SAMPLE_ROWS[0]));
                onPreviewIndex(0);
              }}
            >
              Sample
            </Button>
          </Tooltip>
          {rows.length > 0 && (
            <IconButton size="small" onClick={() => { onData([], []); setError(null); }}>
              <Clear fontSize="small" />
            </IconButton>
          )}
        </Stack>

        {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}

        {rows.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {rows.length.toLocaleString()} rows · {columns.length} columns
          </Typography>
        )}
      </Box>

      {columns.length > 0 && (
        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="caption" color="text.secondary">
            Click a column to copy its placeholder
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {columns.map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                onClick={() => navigator.clipboard.writeText(`{{${c}}}`)}
                color={needed.some((n) => n.toLowerCase() === c.toLowerCase()) ? 'primary' : 'default'}
                variant={needed.some((n) => n.toLowerCase() === c.toLowerCase()) ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>
      )}

      {missing.length > 0 && rows.length > 0 && (
        <Alert severity="warning" sx={{ m: 2 }}>
          Your label uses {missing.map((m) => `{{${m}}}`).join(', ')}, which
          {missing.length === 1 ? ' is' : ' are'} not in this file. Those placeholders
          will print as-is.
        </Alert>
      )}

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: '#94a3b8' }}>
            <Typography variant="body2">
              No data loaded. The label will print once, with placeholders shown as written.
            </Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36 }} />
                {columns.slice(0, 3).map((c) => (
                  <TableCell key={c} sx={{ fontWeight: 700 }}>{c}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(0, 200).map((r, i) => (
                <TableRow
                  key={i}
                  hover
                  selected={i === previewIndex}
                  onClick={() => onPreviewIndex(i)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ p: 0.5 }}>
                    {i === previewIndex && <Visibility fontSize="small" color="primary" />}
                  </TableCell>
                  {columns.slice(0, 3).map((c) => (
                    <TableCell key={c} sx={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(r[c] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {rows.length > 200 && (
          <Typography variant="caption" sx={{ p: 2, display: 'block', color: '#94a3b8' }}>
            Showing the first 200 rows. All {rows.length.toLocaleString()} will print.
          </Typography>
        )}
      </Box>

      <Dialog open={fieldsOpen} onClose={() => setFieldsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Field reference</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Anything in double braces is resolved per label. Click to copy.
          </Typography>
          {FIELD_REFERENCE.map((group) => (
            <Box key={group.title} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>{group.title}</Typography>
              {group.items.map(([code, what]) => (
                <Stack
                  key={code} direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ py: 0.4, cursor: 'pointer', '&:hover': { bgcolor: '#f1f5f9' }, px: 0.5, borderRadius: 1 }}
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{code}</Typography>
                  <Typography variant="caption" color="text.secondary">{what}</Typography>
                </Stack>
              ))}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFieldsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
