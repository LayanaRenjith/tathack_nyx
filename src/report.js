// Monthly report: what was paid, to whom, and how many risky QR codes were stopped.
// Shared with the trusted person as a WhatsApp message the user sends with one tap.

const key = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const monthKey = (at) => { const d = new Date(at); return key(d.getFullYear(), d.getMonth()); };

/** Report for one month (month 0-11). */
export function monthlyReport(history, year, month) {
  const k = key(year, month);
  const items = (history || []).filter((h) => monthKey(h.at) === k);
  const total = items.reduce((s, h) => s + (h.amount || 0), 0);
  const byShop = new Map();
  for (const h of items) {
    const name = h.name || h.vpa;
    const row = byShop.get(name) || { name, amount: 0, count: 0, status: h.status };
    row.amount += h.amount || 0;
    row.count += 1;
    if (h.status !== 'same') row.status = h.status;
    byShop.set(name, row);
  }
  return {
    key: k,
    year,
    month,
    total,
    count: items.length,
    shops: [...byShop.values()].sort((a, b) => b.amount - a.amount),
    warned: items.filter((h) => h.status === 'different').length,
    unchecked: items.filter((h) => h.status === 'new').length,
    biggest: items.reduce((m, h) => (!m || h.amount > m.amount ? h : m), null),
  };
}

/** Totals for the last n months, oldest first, ending with the given month. */
export function lastMonths(history, year, month, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const r = monthlyReport(history, d.getFullYear(), d.getMonth());
    out.push({ key: r.key, year: r.year, month: r.month, total: r.total, count: r.count });
  }
  return out;
}

/** Previous month that has payments and whose report has not been sent yet (for the home reminder). */
export function pendingReport(history, sent = {}, now = Date.now()) {
  const d = new Date(now);
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const r = monthlyReport(history, prev.getFullYear(), prev.getMonth());
  return r.count && !sent[r.key] ? r : null;
}
