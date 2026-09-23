import React from 'react';
import {
  Box, Typography, List, ListItemButton, ListItemText, IconButton,
  Stack, Tooltip, Divider
} from '@mui/material';
import {
  Visibility, VisibilityOff, Lock, LockOpen,
  ArrowUpward, ArrowDownward, TextFields, QrCode, ViewWeek,
  Image as ImageIcon, CropSquare, Remove
} from '@mui/icons-material';

const ICONS = {
  text: <TextFields fontSize="small" />,
  barcode: <ViewWeek fontSize="small" />,
  qr: <QrCode fontSize="small" />,
  image: <ImageIcon fontSize="small" />,
  rect: <CropSquare fontSize="small" />,
  line: <Remove fontSize="small" />
};

const labelFor = (el) => {
  if (el.type === 'text') return el.text?.slice(0, 24) || 'Text';
  if (el.type === 'barcode') return el.value?.slice(0, 24) || 'Barcode';
  if (el.type === 'qr') return el.value?.slice(0, 24) || 'QR code';
  if (el.type === 'image') return el.dataUrl ? 'Image' : 'Empty image';
  return el.type === 'rect' ? 'Box' : 'Line';
};

/**
 * Layers, drawn top-most first — which is the reverse of the array, since
 * later array entries paint on top.
 */
export default function LayersPanel({ elements, selectedIds, onSelect, onPatch, onReorder }) {
  const ordered = [...elements].reverse();

  return (
    <Box sx={{ borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', maxHeight: 260 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, p: 1.5, pb: 0.5 }}>
        Layers
      </Typography>
      <Divider />

      <List dense sx={{ overflowY: 'auto', py: 0 }}>
        {ordered.length === 0 && (
          <Typography variant="caption" sx={{ p: 2, display: 'block', color: '#94a3b8' }}>
            Nothing on the label yet.
          </Typography>
        )}

        {ordered.map((el) => (
          <ListItemButton
            key={el.id}
            selected={selectedIds.includes(el.id)}
            onClick={(e) => onSelect(e.shiftKey ? [...selectedIds, el.id] : [el.id])}
            sx={{ py: 0.25 }}
          >
            <Box sx={{ mr: 1, color: '#64748b', display: 'flex' }}>{ICONS[el.type]}</Box>
            <ListItemText
              primary={labelFor(el)}
              primaryTypographyProps={{
                variant: 'body2',
                noWrap: true,
                sx: { opacity: el.hidden ? 0.45 : 1 }
              }}
            />
            <Stack direction="row" spacing={0}>
              <Tooltip title="Bring forward">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onReorder(el.id, 'forward'); }}>
                  <ArrowUpward sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Send backward">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onReorder(el.id, 'backward'); }}>
                  <ArrowDownward sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={el.hidden ? 'Show' : 'Hide in preview'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onPatch(el.id, { hidden: !el.hidden }); }}>
                  {el.hidden ? <VisibilityOff sx={{ fontSize: 15 }} /> : <Visibility sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={el.locked ? 'Unlock' : 'Lock position'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onPatch(el.id, { locked: !el.locked }); }}>
                  {el.locked ? <Lock sx={{ fontSize: 15 }} /> : <LockOpen sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
            </Stack>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
