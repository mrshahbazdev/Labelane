const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcMain, app } = require('electron');

function dir() {
  const d = path.join(app.getPath('userData'), 'templates');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Template ids become filenames, so they are validated rather than trusted.
function fileFor(id) {
  if (!/^[a-z0-9_-]+$/i.test(String(id))) throw new Error('Invalid template id');
  return path.join(dir(), `${id}.json`);
}

function readAll() {
  return fs.readdirSync(dir())
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
        return {
          id: t.id,
          name: t.name,
          widthMm: t.widthMm,
          heightMm: t.heightMm,
          elementCount: (t.elements || []).length,
          updatedAt: t.updatedAt
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function registerTemplateIPC() {
  ipcMain.handle('templates:list', async () => readAll());

  ipcMain.handle('templates:load', async (_e, id) =>
    JSON.parse(fs.readFileSync(fileFor(id), 'utf8'))
  );

  ipcMain.handle('templates:save', async (_e, tpl) => {
    const id = tpl.id || 'tpl_' + crypto.randomBytes(6).toString('hex');
    const record = { ...tpl, id, updatedAt: new Date().toISOString() };
    fs.writeFileSync(fileFor(id), JSON.stringify(record, null, 2));
    return record;
  });

  ipcMain.handle('templates:remove', async (_e, id) => {
    try { fs.unlinkSync(fileFor(id)); } catch { /* already gone */ }
    return { success: true };
  });

  ipcMain.handle('templates:duplicate', async (_e, id) => {
    const src = JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
    const newId = 'tpl_' + crypto.randomBytes(6).toString('hex');
    const copy = { ...src, id: newId, name: `${src.name} (copy)`, updatedAt: new Date().toISOString() };
    fs.writeFileSync(fileFor(newId), JSON.stringify(copy, null, 2));
    return copy;
  });
}

module.exports = { registerTemplateIPC };
