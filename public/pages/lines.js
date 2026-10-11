// Lines page: #/lines, or #/lines/<id> to open one line (Home's "Your lines now" links here).
// Unplanned delays can be refunded. Planned closures can't, because TfL announces them in advance.
import { lines, findJourney, money, esc } from '../data.js';

const GROUPS = [
  { kind: 'delay', title: 'Delays now',
    note: 'Unplanned delays. If your journey ran 15 minutes or more late, you can get money back.' },
  { kind: 'closure', title: 'Planned closures',
    note: 'Announced in advance, so journeys here can’t be refunded. Plan another route.' },
  { kind: 'good', title: 'Good service', note: '' },
];

// Every state has an icon AND words, never colour alone.
const STATE = {
  delay: { icon: '!', cls: 'is-bad', tag: 'Refund possible', pill: 'eligible' },
  closure: { icon: '✕', cls: 'is-closed', tag: 'Not eligible', pill: 'none' },
  good: { icon: '✓', cls: 'is-ok', tag: '', pill: '' },
};

let openId = null;

// ---------- shared with Home ----------

export function lineBadge(line) {
  return `<span class="line-badge" aria-hidden="true" style="--badge: ${line.colour}; --badge-text: ${line.text}">${esc(line.letter)}</span>`;
}

export function lineStateHtml(line) {
  const s = STATE[line.kind];
  return `<span class="line-state ${s.cls}"><span aria-hidden="true">${s.icon}</span> ${esc(line.status)}</span>`;
}

// ---------- pieces ----------

// What this line means for the user: claim button, "already claimed", or why it can't be refunded.
function actionHtml(line) {
  if (line.kind === 'delay') {
    const j = line.journeyId ? findJourney(line.journeyId) : null;
    if (j && j.status === 'eligible') {
      return `<a class="bt-btn" href="#/journey/${esc(j.id)}">Claim ${money(j.amount)} for your ${esc(j.tapIn)} journey</a>`;
    }
    if (j && (j.status === 'claimed' || j.status === 'paid')) {
      return `<p class="line-note"><span aria-hidden="true">✓</span> Your ${esc(j.tapIn)} journey is already ${j.status === 'paid' ? 'refunded' : 'claimed'}.</p>`;
    }
    return '<p class="line-note">None of your journeys on this line were delayed enough. If one is, we’ll claim for you.</p>';
  }
  if (line.kind === 'closure') {
    return `<p class="line-note">Not eligible for a refund. ${esc(line.alternative || '')}</p>`;
  }
  return '';
}

function cardHtml(line) {
  const s = STATE[line.kind];
  return `<li>
    <details class="bt-sign line-card" id="line-${esc(line.id)}" style="--line: ${line.colour}"${line.id === openId ? ' open' : ''}>
      <summary class="line-summary">
        ${lineBadge(line)}
        <span class="line-main">
          <span class="line-title">${esc(line.name)}${line.yours ? ' <span class="line-yours">Your line</span>' : ''}</span>
          ${lineStateHtml(line)}
        </span>
        ${s.tag ? `<span class="bt-pill" data-status="${s.pill}">${s.tag}</span>` : ''}
      </summary>
      <div class="line-body">
        <p>${esc(line.detail)}</p>
        ${line.when ? `<p><strong>When:</strong> ${esc(line.when)}</p>` : ''}
        ${actionHtml(line)}
      </div>
    </details>
  </li>`;
}

function groupHtml(group) {
  // Your lines first within each group
  const list = lines.filter((l) => l.kind === group.kind).sort((a, b) => b.yours - a.yours);
  if (!list.length) return '';
  return `<section aria-labelledby="lines-${group.kind}">
    <h2 id="lines-${group.kind}" class="lines-group-title">${group.title} <span class="lines-count">${list.length}</span></h2>
    ${group.note ? `<p class="lines-group-note">${group.note}</p>` : ''}
    <ul class="lines-list">${list.map(cardHtml).join('')}</ul>
  </section>`;
}

// ---------- page ----------

export default {
  title: 'Lines',
  tab: 'lines',

  render(id) {
    openId = id || null;
    const count = (kind) => lines.filter((l) => l.kind === kind).length;
    const updated = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    return `<main class="lines-page">
      <div>
        <h1 class="lines-title">Lines</h1>
        <p class="lines-updated">Updated ${updated} · ${count('delay')} delayed · ${count('closure')} planned closures</p>
      </div>

      <div class="bt-sign lines-key" style="--line: var(--bt-yellow)">
        <p><strong>Delays</strong> happen without warning. If your journey ran 15+ minutes late, you can get money back, and Backtrack claims it for you.</p>
        <p><strong>Planned closures</strong> are announced in advance, so they can’t be refunded.</p>
      </div>

      ${GROUPS.map(groupHtml).join('')}
    </main>`;
  },

  // Coming from Home (#/lines/victoria): open that line, scroll to it and move focus there.
  afterRender(root) {
    if (!openId) return;
    const card = root.querySelector(`#line-${CSS.escape(openId)}`);
    if (!card) return;
    requestAnimationFrame(() => {
      card.scrollIntoView({ block: 'center' });
      card.querySelector('summary').focus({ preventScroll: true });
    });
  },
};