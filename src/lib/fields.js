/**
 * Dynamic fields.
 *
 * Everything inside {{ }} runs through here. Beyond plain CSV columns this
 * supports counters, dates, arithmetic and text transforms — the things that
 * turn a label designer into something a production line can actually use,
 * and the reason people pay for the expensive packages.
 *
 *   {{sku}}                         a column
 *   {{serial}}                      auto-increment, 1 per label
 *   {{serial:start=1000,pad=5}}     …starting at 1000, zero-padded
 *   {{date}}                        today
 *   {{date:+180,format=MM/YYYY}}    180 days out — expiry dates
 *   {{row}}                         1-based label number in the run
 *   {{title|upper}}                 transforms, chained with |
 *   {{= price * 1.17 }}             arithmetic over columns
 *
 * Expressions are parsed and evaluated by hand rather than with new Function.
 * The production CSP is script-src 'self', so anything eval-shaped would be
 * blocked in the packaged app even if it worked in dev.
 */

const FIELD_RE = /\{\{\s*([\s\S]+?)\s*\}\}/g;

// ---------------------------------------------------------------- transforms

const TRANSFORMS = {
  upper: (v) => String(v).toUpperCase(),
  lower: (v) => String(v).toLowerCase(),
  title: (v) => String(v).replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  trim: (v) => String(v).trim(),
  pad: (v, n = 6, ch = '0') => String(v).padStart(Number(n) || 6, ch),
  fixed: (v, n = 2) => {
    const num = toNumber(v);
    return Number.isFinite(num) ? num.toFixed(Number(n) || 0) : String(v);
  },
  money: (v, symbol = '', n = 2) => {
    const num = toNumber(v);
    if (!Number.isFinite(num)) return String(v);
    const body = num.toFixed(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return symbol ? `${symbol} ${body}` : body;
  },
  left: (v, n = 10) => String(v).slice(0, Number(n) || 10),
  right: (v, n = 10) => String(v).slice(-(Number(n) || 10)),
  // Long product names wreck a small label; ellipsis is better than a clip.
  truncate: (v, n = 20) => {
    const s = String(v);
    const max = Number(n) || 20;
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
  },
  default: (v, fallback = '') => (String(v).trim() === '' ? fallback : v)
};

export const TRANSFORM_HELP = [
  ['upper', 'ABC'],
  ['lower', 'abc'],
  ['title', 'Abc Def'],
  ['trim', 'strip spaces'],
  ['pad:6', '000123'],
  ['fixed:2', '12.50'],
  ['money:Rs', 'Rs 1,250.00'],
  ['truncate:20', 'long name…'],
  ['default:N/A', 'fallback when empty']
];

function toNumber(v) {
  if (typeof v === 'number') return v;
  const cleaned = String(v ?? '').replace(/[^0-9.\-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

// ------------------------------------------------------------------- dates

function formatDate(d, pattern = 'DD/MM/YYYY') {
  const pad = (n) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return pattern
    .replace(/YYYY/g, d.getFullYear())
    .replace(/YY/g, String(d.getFullYear()).slice(-2))
    .replace(/MMM/g, months[d.getMonth()])
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()));
}

function parseArgs(raw) {
  const args = { _positional: [] };
  if (!raw) return args;

  for (const part of raw.split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    const eq = chunk.indexOf('=');
    if (eq > 0) args[chunk.slice(0, eq).trim()] = chunk.slice(eq + 1).trim();
    else args._positional.push(chunk);
  }
  return args;
}

// ------------------------------------------------------------- expressions

/** Tokenise an arithmetic expression. Column names may contain spaces. */
function tokenize(src) {
  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    if (/\s/.test(c)) { i++; continue; }

    if ('+-*/%()'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }

    if (c === '[') {
      const end = src.indexOf(']', i);
      if (end === -1) throw new Error('unclosed [');
      tokens.push({ t: 'ref', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    let j = i;
    while (j < src.length && /[A-Za-z0-9_ ]/.test(src[j]) && !'+-*/%()'.includes(src[j])) j++;
    const word = src.slice(i, j).trim();
    if (!word) throw new Error(`unexpected character "${c}"`);
    tokens.push({ t: 'ref', v: word });
    i = j;
  }

  return tokens;
}

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };

/** Shunting-yard to RPN, then evaluate. No eval, no Function constructor. */
function evaluate(src, row) {
  const tokens = tokenize(src);
  const output = [];
  const ops = [];

  for (const tok of tokens) {
    if (tok.t === 'num' || tok.t === 'ref') { output.push(tok); continue; }
    if (tok.v === '(') { ops.push(tok); continue; }

    if (tok.v === ')') {
      while (ops.length && ops[ops.length - 1].v !== '(') output.push(ops.pop());
      if (!ops.length) throw new Error('unbalanced )');
      ops.pop();
      continue;
    }

    while (
      ops.length &&
      ops[ops.length - 1].v !== '(' &&
      PRECEDENCE[ops[ops.length - 1].v] >= PRECEDENCE[tok.v]
    ) output.push(ops.pop());
    ops.push(tok);
  }

  while (ops.length) {
    const op = ops.pop();
    if (op.v === '(') throw new Error('unbalanced (');
    output.push(op);
  }

  const stack = [];
  for (const tok of output) {
    if (tok.t === 'num') { stack.push(tok.v); continue; }

    if (tok.t === 'ref') {
      const key = Object.keys(row || {}).find((k) => k.toLowerCase() === tok.v.toLowerCase());
      const n = toNumber(key === undefined ? NaN : row[key]);
      stack.push(Number.isFinite(n) ? n : 0);
      continue;
    }

    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) throw new Error('incomplete expression');

    switch (tok.v) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/': stack.push(b === 0 ? 0 : a / b); break;
      case '%': stack.push(b === 0 ? 0 : a % b); break;
      default: throw new Error(`bad operator ${tok.v}`);
    }
  }

  if (stack.length !== 1) throw new Error('incomplete expression');
  return stack[0];
}

// ------------------------------------------------------------------ resolve

function lookupColumn(name, row) {
  if (!row) return undefined;
  const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : row[key];
}

function resolveOne(body, ctx) {
  const { row, index = 0 } = ctx || {};

  // {{= expression }}
  if (body.startsWith('=')) {
    const [expr, ...pipes] = body.slice(1).split('|');
    try {
      let value = evaluate(expr, row);
      value = Math.round(value * 1e6) / 1e6;
      return applyTransforms(value, pipes);
    } catch (err) {
      return `#${err.message}`;
    }
  }

  const [head, ...pipes] = body.split('|');
  const colon = head.indexOf(':');
  const name = (colon === -1 ? head : head.slice(0, colon)).trim();
  const args = parseArgs(colon === -1 ? '' : head.slice(colon + 1));
  const lower = name.toLowerCase();

  if (lower === 'serial' || lower === 'counter') {
    const start = Number(args.start ?? args._positional[0] ?? 1);
    const step = Number(args.step ?? 1);
    let value = String(start + index * step);
    if (args.pad) value = value.padStart(Number(args.pad), '0');
    return applyTransforms(`${args.prefix || ''}${value}${args.suffix || ''}`, pipes);
  }

  if (lower === 'row') return applyTransforms(String(index + 1), pipes);

  if (lower === 'date' || lower === 'time') {
    const d = new Date();
    const offset = args.offset ?? args._positional.find((p) => /^[+-]?\d+$/.test(p));
    if (offset) d.setDate(d.getDate() + Number(offset));
    const pattern = args.format || (lower === 'time' ? 'HH:mm' : 'DD/MM/YYYY');
    return applyTransforms(formatDate(d, pattern), pipes);
  }

  const raw = lookupColumn(name, row);
  // An unmatched placeholder prints as written, so the mistake is visible on
  // the proof rather than silently blank on 500 labels.
  if (raw === undefined) return applyTransforms(`{{${body}}}`, pipes, true);

  return applyTransforms(raw, pipes);
}

function applyTransforms(value, pipes, skipIfUnmatched = false) {
  if (skipIfUnmatched) return String(value);

  let out = value;
  for (const pipe of pipes) {
    const spec = pipe.trim();
    if (!spec) continue;
    const [nameRaw, ...argParts] = spec.split(':');
    const fn = TRANSFORMS[nameRaw.trim().toLowerCase()];
    if (fn) out = fn(out, ...argParts.map((a) => a.trim()));
  }
  return String(out ?? '');
}

/** Replace every {{...}} in a string. */
export function resolve(text, ctx) {
  if (text === null || text === undefined) return '';
  return String(text).replace(FIELD_RE, (_m, body) => resolveOne(body, ctx));
}

/** True when the value resolves to nothing — drives "hide when empty". */
export function resolvesEmpty(text, ctx) {
  const out = resolve(text, ctx).trim();
  return out === '' || /^\{\{.*\}\}$/.test(out);
}

/** Column names a template depends on, ignoring built-ins and expressions. */
export function referencedColumns(elements) {
  const builtins = new Set(['serial', 'counter', 'row', 'date', 'time']);
  const found = new Set();

  const scan = (v) => {
    if (!v) return;
    let m;
    const re = new RegExp(FIELD_RE.source, 'g');
    while ((m = re.exec(String(v))) !== null) {
      const body = m[1];
      if (body.startsWith('=')) {
        // pull [refs] and bare words out of the expression
        for (const ref of body.matchAll(/\[([^\]]+)\]/g)) found.add(ref[1].trim());
        continue;
      }
      const head = body.split('|')[0];
      const name = (head.includes(':') ? head.slice(0, head.indexOf(':')) : head).trim();
      if (!builtins.has(name.toLowerCase())) found.add(name);
    }
  };

  elements.forEach((el) => { scan(el.text); scan(el.value); });
  return [...found];
}
