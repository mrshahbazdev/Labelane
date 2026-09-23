import React from 'react';
import {
  Box, Typography, TextField, MenuItem, Stack, Divider, IconButton,
  ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, Tooltip, Button,
  Accordion, AccordionSummary, AccordionDetails, Alert, ListSubheader
} from '@mui/material';
import {
  FormatBold, FormatItalic, FormatAlignLeft, FormatAlignCenter,
  FormatAlignRight, Delete, ContentCopy, Image as ImageIcon, ExpandMore,
  AlignHorizontalLeft, AlignHorizontalCenter, AlignHorizontalRight,
  AlignVerticalTop, AlignVerticalCenter, AlignVerticalBottom,
  HorizontalSplit, VerticalSplit
} from '@mui/icons-material';
import { BARCODE_FORMATS, FONTS, SIZE_PRESETS, SHEET_PRESETS } from '../lib/model';
import { sheetCapacity } from '../lib/labelHtml';

const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));
const Row = ({ children }) => <Stack direction="row" spacing={1}>{children}</Stack>;
const Field = (props) => <TextField size="small" fullWidth {...props} />;

function AlignBar({ onAlign, onDistribute, count }) {
  const items = [
    ['left', <AlignHorizontalLeft fontSize="small" />, 'Align left'],
    ['centerX', <AlignHorizontalCenter fontSize="small" />, 'Centre horizontally'],
    ['right', <AlignHorizontalRight fontSize="small" />, 'Align right'],
    ['top', <AlignVerticalTop fontSize="small" />, 'Align top'],
    ['centerY', <AlignVerticalCenter fontSize="small" />, 'Centre vertically'],
    ['bottom', <AlignVerticalBottom fontSize="small" />, 'Align bottom']
  ];

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {count > 1 ? `Align ${count} elements to each other` : 'Align to the label'}
      </Typography>
      <Stack direction="row" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
        {items.map(([mode, icon, tip]) => (
          <Tooltip key={mode} title={tip}>
            <IconButton size="small" onClick={() => onAlign(mode)}>{icon}</IconButton>
          </Tooltip>
        ))}
        <Tooltip title="Distribute horizontally (3+)">
          <span>
            <IconButton size="small" disabled={count < 3} onClick={() => onDistribute('x')}>
              <HorizontalSplit fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Distribute vertically (3+)">
          <span>
            <IconButton size="small" disabled={count < 3} onClick={() => onDistribute('y')}>
              <VerticalSplit fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function SheetSection({ template, onTemplate }) {
  const sheet = template.sheet || {};
  const cap = sheet.enabled ? sheetCapacity(template) : null;
  const patch = (p) => onTemplate({ sheet: { ...sheet, ...p } });

  return (
    <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Sheet layout {sheet.enabled ? '· on' : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0 }}>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={!!sheet.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
            }
            label="Print many per page"
          />

          <Typography variant="caption" color="text.secondary">
            For laser and inkjet printers using A4 label sheets. Leave off for
            thermal roll printers.
          </Typography>

          {sheet.enabled && (
            <>
              <Field
                select label="Sheet preset" value=""
                onChange={(e) => {
                  const p = SHEET_PRESETS[e.target.value];
                  if (p) {
                    onTemplate({
                      widthMm: p.labelW,
                      heightMm: p.labelH,
                      sheet: { ...sheet, ...p.sheet, enabled: true }
                    });
                  }
                }}
              >
                {SHEET_PRESETS.map((p, i) => (
                  <MenuItem key={p.name} value={i}>{p.name}</MenuItem>
                ))}
              </Field>

              <Row>
                <Field label="Page W (mm)" type="number" value={sheet.pageW ?? 210}
                  onChange={(e) => patch({ pageW: num(e.target.value) || 210 })} />
                <Field label="Page H (mm)" type="number" value={sheet.pageH ?? 297}
                  onChange={(e) => patch({ pageH: num(e.target.value) || 297 })} />
              </Row>
              <Row>
                <Field label="Columns" type="number" value={sheet.cols ?? 3}
                  onChange={(e) => patch({ cols: Math.max(1, num(e.target.value) || 1) })} />
                <Field label="Rows" type="number" value={sheet.rows ?? 8}
                  onChange={(e) => patch({ rows: Math.max(1, num(e.target.value) || 1) })} />
              </Row>
              <Row>
                <Field label="Margin top (mm)" type="number" value={sheet.marginTop ?? 10}
                  onChange={(e) => patch({ marginTop: num(e.target.value) || 0 })} />
                <Field label="Margin left (mm)" type="number" value={sheet.marginLeft ?? 7}
                  onChange={(e) => patch({ marginLeft: num(e.target.value) || 0 })} />
              </Row>
              <Row>
                <Field label="Gap X (mm)" type="number" value={sheet.gapX ?? 2.5}
                  onChange={(e) => patch({ gapX: num(e.target.value) || 0 })} />
                <Field label="Gap Y (mm)" type="number" value={sheet.gapY ?? 0}
                  onChange={(e) => patch({ gapY: num(e.target.value) || 0 })} />
              </Row>

              <FormControlLabel
                control={
                  <Switch
                    checked={!!sheet.showOutline}
                    onChange={(e) => patch({ showOutline: e.target.checked })}
                  />
                }
                label="Print cut outlines"
              />

              {cap && (
                cap.fits
                  ? <Alert severity="success">Fits. Up to {cap.cols} × {cap.rows} at this size.</Alert>
                  : <Alert severity="error">
                      Too big for the page — only {cap.cols} × {cap.rows} fit.
                      Reduce columns, rows, or the label size.
                    </Alert>
              )}
            </>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export default function Inspector({
  template, selection, onTemplate, onElement, onDelete, onDuplicate, onAlign, onDistribute
}) {
  // Nothing selected — label and sheet setup
  if (selection.length === 0) {
    return (
      <Box sx={{ p: 2, width: 310, borderLeft: '1px solid #e2e8f0', overflowY: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Label setup</Typography>

        <Stack spacing={1.5}>
          <Field label="Template name" value={template.name}
            onChange={(e) => onTemplate({ name: e.target.value })} />

          <Field
            select label="Size preset" value=""
            onChange={(e) => {
              const p = SIZE_PRESETS[e.target.value];
              if (p) onTemplate({ widthMm: p.w, heightMm: p.h });
            }}
          >
            {SIZE_PRESETS.map((p, i) => <MenuItem key={p.name} value={i}>{p.name}</MenuItem>)}
          </Field>

          <Row>
            <Field label="Width (mm)" type="number" value={template.widthMm}
              onChange={(e) => onTemplate({ widthMm: Math.max(5, num(e.target.value) || 5) })} />
            <Field label="Height (mm)" type="number" value={template.heightMm}
              onChange={(e) => onTemplate({ heightMm: Math.max(5, num(e.target.value) || 5) })} />
          </Row>

          <Field label="Copies per row" type="number" value={template.copies ?? 1}
            onChange={(e) => onTemplate({ copies: Math.max(1, num(e.target.value) || 1) })}
            helperText="A __copies column in your CSV overrides this per row" />
        </Stack>

        <Divider sx={{ my: 2 }} />
        <SheetSection template={template} onTemplate={onTemplate} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Use {'{{column}}'} in any text, barcode or QR value to pull from your data file.
          Hold Alt while dragging to ignore snapping.
        </Typography>
      </Box>
    );
  }

  // Several selected — arrangement only
  if (selection.length > 1) {
    return (
      <Box sx={{ p: 2, width: 310, borderLeft: '1px solid #e2e8f0', overflowY: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
          {selection.length} elements selected
        </Typography>
        <AlignBar onAlign={onAlign} onDistribute={onDistribute} count={selection.length} />
        <Divider sx={{ my: 2 }} />
        <Button fullWidth color="error" startIcon={<Delete />}
          onClick={() => selection.forEach((el) => onDelete(el.id))}>
          Delete all
        </Button>
      </Box>
    );
  }

  const element = selection[0];
  const set = (patch) => onElement(element.id, patch);
  const fmt = BARCODE_FORMATS.find((f) => f.value === element.format);

  return (
    <Box sx={{ p: 2, width: 310, borderLeft: '1px solid #e2e8f0', overflowY: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>
          {element.type}
        </Typography>
        <Stack direction="row">
          <Tooltip title="Duplicate (Ctrl+D)">
            <IconButton size="small" onClick={() => onDuplicate(element.id)}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(element.id)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <AlignBar onAlign={onAlign} onDistribute={onDistribute} count={1} />
      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={1.5}>
        <Row>
          <Field label="X (mm)" type="number" value={element.x}
            onChange={(e) => set({ x: num(e.target.value) || 0 })} />
          <Field label="Y (mm)" type="number" value={element.y}
            onChange={(e) => set({ y: num(e.target.value) || 0 })} />
        </Row>
        <Row>
          <Field label="W (mm)" type="number" value={element.w}
            onChange={(e) => set({ w: Math.max(1, num(e.target.value) || 1) })} />
          <Field label="H (mm)" type="number" value={element.h}
            onChange={(e) => set({ h: Math.max(0.2, num(e.target.value) || 0.2) })} />
        </Row>
        <Field label="Rotation (deg)" type="number" value={element.rotate || 0}
          onChange={(e) => set({ rotate: num(e.target.value) || 0 })} />

        <Divider />

        {element.type === 'text' && (
          <>
            <Field label="Text" multiline minRows={2} value={element.text || ''}
              onChange={(e) => set({ text: e.target.value })} />
            <Field select label="Font" value={element.fontFamily || FONTS[0]}
              onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (
                <MenuItem key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0]}</MenuItem>
              ))}
            </Field>
            <Row>
              <Field label="Size (pt)" type="number" value={element.fontSize || 10}
                onChange={(e) => set({ fontSize: Math.max(1, num(e.target.value) || 1) })} />
              <Field label="Colour" type="color" value={element.color || '#000000'}
                onChange={(e) => set({ color: e.target.value })} />
            </Row>
            <Stack direction="row" spacing={1}>
              <ToggleButtonGroup size="small">
                <ToggleButton value="b" selected={!!element.bold} onClick={() => set({ bold: !element.bold })}>
                  <FormatBold fontSize="small" />
                </ToggleButton>
                <ToggleButton value="i" selected={!!element.italic} onClick={() => set({ italic: !element.italic })}>
                  <FormatItalic fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup size="small" exclusive value={element.align || 'left'}
                onChange={(_e, v) => v && set({ align: v })}>
                <ToggleButton value="left"><FormatAlignLeft fontSize="small" /></ToggleButton>
                <ToggleButton value="center"><FormatAlignCenter fontSize="small" /></ToggleButton>
                <ToggleButton value="right"><FormatAlignRight fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Field select label="Vertical align" value={element.vAlign || 'middle'}
              onChange={(e) => set({ vAlign: e.target.value })}>
              <MenuItem value="top">Top</MenuItem>
              <MenuItem value="middle">Middle</MenuItem>
              <MenuItem value="bottom">Bottom</MenuItem>
            </Field>

            <FormControlLabel
              control={<Switch checked={!!element.autoShrink}
                onChange={(e) => set({ autoShrink: e.target.checked })} />}
              label="Shrink text to fit"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              Font size drops automatically when a long value would overflow.
              Essential once names come from a data file.
            </Typography>

            <FormControlLabel
              control={<Switch checked={!!element.hideIfEmpty}
                onChange={(e) => set({ hideIfEmpty: e.target.checked })} />}
              label="Hide when empty"
            />

            <FormControlLabel
              control={<Switch checked={!!element.rtl}
                onChange={(e) => set({ rtl: e.target.checked })} />}
              label="Right-to-left (Urdu, Arabic)"
            />
          </>
        )}

        {element.type === 'barcode' && (
          <>
            <Field label="Value" value={element.value || ''}
              onChange={(e) => set({ value: e.target.value })}
              helperText="Literal text, or {{column}} from your data" />
            <Field select label="Symbology" value={element.format || 'CODE128'}
              onChange={(e) => set({ format: e.target.value })} helperText={fmt?.hint}>
              {BARCODE_FORMATS.filter((f) => !f.group).map((f) => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
              <ListSubheader>2D and GS1</ListSubheader>
              {BARCODE_FORMATS.filter((f) => f.group).map((f) => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
            </Field>
            <FormControlLabel
              control={<Switch checked={element.showValue !== false}
                onChange={(e) => set({ showValue: e.target.checked })} />}
              label="Show number under bars"
            />
            <Row>
              <Field label="Bar width" type="number" value={element.barWidth ?? 2}
                onChange={(e) => set({ barWidth: Math.max(1, num(e.target.value) || 1) })}
                helperText="Raise if scanners struggle" />
              <Field label="Text size" type="number" value={element.fontSize ?? 16}
                onChange={(e) => set({ fontSize: Math.max(1, num(e.target.value) || 1) })} />
            </Row>
            <Field label="Bar colour" type="color" value={element.lineColor || '#000000'}
              onChange={(e) => set({ lineColor: e.target.value })} />
            <FormControlLabel
              control={<Switch checked={!!element.hideIfEmpty}
                onChange={(e) => set({ hideIfEmpty: e.target.checked })} />}
              label="Hide when empty"
            />
          </>
        )}

        {element.type === 'qr' && (
          <>
            <Field label="Value" multiline minRows={2} value={element.value || ''}
              onChange={(e) => set({ value: e.target.value })}
              helperText="URL or text, or {{column}}" />
            <Field select label="Error correction" value={element.ecl || 'M'}
              onChange={(e) => set({ ecl: e.target.value })}
              helperText="Higher survives smudges but holds less data">
              <MenuItem value="L">Low (7%)</MenuItem>
              <MenuItem value="M">Medium (15%)</MenuItem>
              <MenuItem value="Q">Quartile (25%)</MenuItem>
              <MenuItem value="H">High (30%)</MenuItem>
            </Field>
            <Field label="Colour" type="color" value={element.color || '#000000'}
              onChange={(e) => set({ color: e.target.value })} />
          </>
        )}

        {element.type === 'image' && (
          <>
            <Button variant="outlined" startIcon={<ImageIcon />}
              onClick={async () => {
                const file = await window.api.app.openFile({
                  filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
                });
                if (file?.dataUrl) set({ dataUrl: file.dataUrl });
              }}>
              {element.dataUrl ? 'Replace image' : 'Choose image'}
            </Button>
            <Field select label="Fit" value={element.fit || 'contain'}
              onChange={(e) => set({ fit: e.target.value })}>
              <MenuItem value="contain">Contain (whole image)</MenuItem>
              <MenuItem value="cover">Cover (fill, may crop)</MenuItem>
              <MenuItem value="fill">Stretch</MenuItem>
            </Field>
          </>
        )}

        {element.type === 'rect' && (
          <>
            <Field label="Fill" type="color"
              value={element.fill === 'transparent' ? '#ffffff' : (element.fill || '#ffffff')}
              onChange={(e) => set({ fill: e.target.value })} />
            <Button size="small" onClick={() => set({ fill: 'transparent' })}>No fill</Button>
            <Row>
              <Field label="Border" type="color" value={element.borderColor || '#000000'}
                onChange={(e) => set({ borderColor: e.target.value })} />
              <Field label="Width (mm)" type="number" value={element.borderWidth ?? 0.3}
                onChange={(e) => set({ borderWidth: Math.max(0, num(e.target.value) || 0) })} />
            </Row>
            <Field label="Corner radius (mm)" type="number" value={element.radius || 0}
              onChange={(e) => set({ radius: Math.max(0, num(e.target.value) || 0) })} />
          </>
        )}

        {element.type === 'line' && (
          <Field label="Colour" type="color" value={element.color || '#000000'}
            onChange={(e) => set({ color: e.target.value })} />
        )}
      </Stack>
    </Box>
  );
}
