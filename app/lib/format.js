export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "fragile, Glass ,fragile" → ['fragile', 'Glass'] */
export function splitTags(text) {
  return [...new Set(String(text ?? '').split(',').map((t) => t.trim()).filter(Boolean))];
}

// Shared display formatters. One definition each so KPI cards, charts and tables never disagree.

/** $1,240.50 — whole dollars by default, cents only when asked. */
export function money(amount, { currency = 'USD', cents = false } = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(Number(amount) || 0);
}

/** 1,240 */
export function number(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

/** 0.962 → "96%"; pass digits for "96.2%". */
export function percent(value, digits = 0) {
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

/** Signed percentage-point style delta for KPI comparisons: 0.08 → "+8%". */
export function delta(value, digits = 0) {
  const v = Number(value) * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DATETIME_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "Oct 14, 2026" */
export function date(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

/** "Oct 14, 3:20 PM" */
export function dateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATETIME_FMT.format(d);
}

/** "3 hours ago" / "in 2 days" — coarse, good enough for logs and timelines. */
export function relative(value) {
  const d = value instanceof Date ? value : new Date(value);
  const diff = d.getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  const abs = Math.abs(mins);
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(mins), 'minute');
  if (abs < 1440) return rtf.format(Math.round(mins / 60), 'hour');
  return rtf.format(Math.round(mins / 1440), 'day');
}
