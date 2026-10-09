// Monthly report screen: total, last six months, where the money went, risky QRs stopped,
// and one tap (or "send" by voice) to share it with the trusted person on WhatsApp.

import * as store from './store.js';
import { monthlyReport, lastMonths } from './report.js';
import { formatRupees } from './amount.js';
import { whatsappLink } from './family.js';
import { icon } from './icons.js';
import { route, replace, go, render, on, esc, tr, P, S, announce, setVoice } from './ui.js';

const money = (n) => formatRupees(n);
const locale = () => (P().lang === 'en' ? 'en-IN' : `${P().lang}-IN`);
const monthName = (y, m, style = 'long') => new Date(y, m, 1).toLocaleString(locale(), { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) });

export function reportMessage(r, userName) {
  const month = monthName(r.year, r.month);
  const lines = r.shops.slice(0, 6).map((x) => `• ${x.name}: ${money(x.amount)} (${x.count})`).join('\n');
  const warn = r.warned ? `\n${tr('report_msg_warn', { n: r.warned })}` : '';
  return `${tr('report_msg', { user: userName, month, total: money(r.total), n: r.count })}\n${lines}${warn}`;
}

route('report', (offset = 0) => {
  const s = S();
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const r = monthlyReport(s.history, d.getFullYear(), d.getMonth());
  const months = lastMonths(s.history, d.getFullYear(), d.getMonth(), 6);
  const max = Math.max(1, ...months.map((x) => x.total));
  const person = s.trusted[0] || null;
  const month = monthName(r.year, r.month);
  const msg = person && r.count ? reportMessage(r, s.user.name) : '';
  const sent = s.reportsSent?.[r.key];
  const topShop = r.shops[0]?.amount || 1;

  render(`
    <section class="screen report">
      <div class="month-switch" role="group" aria-label="${esc(tr('report_title'))}">
        <button class="icon-btn" id="prev" aria-label="${esc(tr('report_prev'))}">${icon('back')}</button>
        <h1>${esc(month)}</h1>
        <button class="icon-btn" id="next" aria-label="${esc(tr('report_next'))}" ${offset >= 0 ? 'disabled' : ''}>${icon('chevron')}</button>
      </div>

      <div class="stat-card tone-green readable">
        <p class="stat-label">${esc(tr('report_total'))}</p>
        <p class="stat-value">${esc(money(r.total))}</p>
        <p class="stat-sub">${esc(tr('report_count', { n: r.count }))}</p>
      </div>

      <div class="mini-stats">
        <div class="mini tone-teal"><span class="badge">${icon('check')}</span><strong>${r.count - r.unchecked - r.warned}</strong><small>${esc(tr('st_same'))}</small></div>
        <div class="mini tone-amber"><span class="badge">${icon('info')}</span><strong>${r.unchecked}</strong><small>${esc(tr('st_new'))}</small></div>
        <div class="mini tone-pink"><span class="badge">${icon('shield')}</span><strong>${r.warned}</strong><small>${esc(tr('report_stopped'))}</small></div>
      </div>

      <div class="card">
        <p class="card-title">${icon('chart')} ${esc(tr('report_months'))}</p>
        <div class="bars" role="list">
          ${months.map((x) => `
            <div class="bar-col ${x.key === r.key ? 'is-now' : ''}" role="listitem" title="${esc(`${monthName(x.year, x.month)}: ${money(x.total)}`)}" aria-label="${esc(`${monthName(x.year, x.month)}: ${money(x.total)}`)}">
              <span class="bar-val">${x.key === r.key && x.total ? esc(money(x.total)) : ''}</span>
              <span class="bar" style="height:${Math.max(x.total ? 6 : 2, Math.round((x.total / max) * 100))}%"></span>
              <span class="bar-lbl">${esc(monthName(x.year, x.month, 'short'))}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <p class="card-title">${icon('store')} ${esc(tr('report_by_shop'))}</p>
        ${r.shops.length ? `<ul class="shop-bars">${r.shops.slice(0, 8).map((x) => `
          <li>
            <div class="shop-line"><span class="grow">${esc(x.name)} <small class="muted">×${x.count}</small></span><strong>${esc(money(x.amount))}</strong></div>
            <span class="shop-bar"><span style="width:${Math.max(4, Math.round((x.amount / topShop) * 100))}%"></span></span>
          </li>`).join('')}</ul>` : `<p class="muted">${esc(tr('report_empty', { month }))}</p>`}
      </div>

      ${person ? (r.count ? `
        <a class="btn big wide whatsapp" id="send" href="${esc(whatsappLink(person.phone, msg))}" target="_blank" rel="noopener" data-next>${icon('whatsapp')}<span>${esc(tr('report_send', { name: person.name }))}</span></a>
        ${sent ? `<p class="hint center">${icon('check')} ${esc(tr('report_sent'))}</p>` : ''}` : '')
      : `<button class="btn wide" id="add-person">${icon('family')}<span>${esc(tr('report_add_person'))}</span></button>`}
    </section>`, { top: 'back', nav: 'report', title: tr('report_title') });

  const spoken = r.count
    ? `${tr('report_spoken', { month, total: money(r.total), n: r.count })} ${r.shops.slice(0, 3).map((x) => `${x.name} ${money(x.amount)}`).join(', ')}. ${r.warned ? tr('report_msg_warn', { n: r.warned }) : ''}`
    : tr('report_empty', { month });
  const markSent = () => store.update({ reportsSent: { ...(S().reportsSent || {}), [r.key]: Date.now() } });
  const send = () => { if (!msg) return; markSent(); window.open(whatsappLink(person.phone, msg), '_blank'); };
  setVoice({
    help: tr('vm_report_help', { name: person?.name || '' }),
    actions: {
      send,
      tell: send,
    },
  });
  announce(spoken);
  on('#send', 'click', markSent);
  on('#prev', 'click', () => replace('report', offset - 1));
  on('#next', 'click', () => { if (offset < 0) replace('report', offset + 1); });
  on('#add-person', 'click', () => go('trusted'));
});
