// Refund page: one journey and where its refund has got to.  Opened with #/journey/<id>
//
// For an eligible journey you haven't claimed yet, this is the claim screen:
//   journey details are filled in from your taps; only the lines and minutes late can change,
//   and "Checked for you" re-checks them as you type. Then pick a pot, agree, and send.
// After sending, the route line updates live as TfL reviews it:
//   Delayed → Checked → Claimed → Paid → Saved
//
// The live journey (live: true in data.js) uses the real bank API:
//   POST /api/tfl-claims/draft → POST /api/tfl-claims → GET /api/tfl-claims/:id (every 1.5 s)
// If the API can't be reached, it plays the same steps in "demo mode" so a demo never breaks.
import { findJourney, journeys, pots, findPot, money, esc } from '../data.js';
import { api } from '../api.js';

// Claims started in this session, by journey id: { status, potId, late, lines, claimId, receivedAt, last4, message }
// status: sending → received → under_review → approved | rejected
const claims = {};

// What you've typed on the claim screen before sending, by journey id: { late, lines, potId }
const drafts = {};

// Lines you can pick for the live journey. `reported` = what TfL's status feed said at that time.
const LINE_CHOICES = [
  { id: 'victoria', name: 'Victoria', reported: 'a signal failure at Oxford Circus' },
  { id: 'northern', name: 'Northern', reported: null },
];

let currentId = null; // the journey on screen
let root = null;      // where the page is drawn

// ---------- helpers ----------

const timeNow = (iso) => new Date(iso || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const potName = (id) => findPot(id)?.name || 'your pot';

function potNote(p) {
  return p.target ? `${p.goal} · ${money(p.saved)} of ${money(p.target)}` : `${p.goal} · ${money(p.saved)}`;
}

// ---------- the one-sentence answer to "do I need to do anything?" ----------

function headline(j, c) {
  if (j.live) {
    if (!c) {
      return { tone: 'wait', icon: '£', title: `You're owed ${money(j.amount)}.`,
        body: "We've checked everything for you. Choose where the money goes, then send the claim." };
    }
    const pot = potName(c.potId);
    switch (c.status) {
      case 'sending':
        return { tone: 'wait', icon: '◷', title: 'Sending your claim to TfL…', body: 'This only takes a moment.' };
      case 'received':
      case 'under_review':
        return { tone: 'wait', icon: '◷', title: `${money(j.amount)} is on its way to ${pot}. Nothing for you to do.`,
          body: 'TfL is checking its records. For real this takes up to 10 working days; in the demo, a few seconds.' };
      case 'approved':
        return { tone: 'good', icon: '✓', title: `${money(j.amount)} back. Moved to ${pot}.`,
          body: `TfL approved your claim${c.claimId ? ` (ref ${c.claimId})` : ''}.` };
      case 'rejected':
        return { tone: 'none', icon: '–', title: "TfL didn't approve this one.",
          body: `${c.message} If you think that's wrong, you can appeal by calling TfL on 0343 222 1234.` };
    }
  }

  switch (j.status) {
    case 'eligible':
      return { tone: 'wait', icon: '◷', title: `You're owed ${money(j.amount)}. Nothing for you to do.`,
        body: "We're waiting 48 hours in case TfL refunds you automatically, then we'll claim for you." };
    case 'claimed':
      return { tone: 'wait', icon: '◷', title: `${money(j.amount)} is on its way. Nothing for you to do.`,
        body: "We've sent the claim to TfL. We'll tell you when the money lands." };
    case 'paid':
      return { tone: 'good', icon: '✓', title: `${money(j.amount)} back. All done.`,
        body: `TfL paid it on ${j.paidDate} and we moved it to ${j.pot}.` };
    case 'none':
      return { tone: 'none', icon: '–', title: 'No refund this time.',
        body: `${j.note} That's TfL's rule, not something you did wrong.` };
    default:
      return { tone: 'good', icon: '✓', title: 'This journey was on time.', body: 'Nothing to claim.' };
  }
}

// ---------- the refund as a route line ----------

// Each stop has a title, a detail line and a state:
// done, current (happening now), todo (still to come) or stopped (ends here).
function stops(j, c) {
  const late = c?.late != null ? Number(c.late) : j.mins != null ? j.mins - j.usual : null;
  const tapped = j.tapOut ? `Tap in ${j.tapIn}, tap out ${j.tapOut}` : `Tap in ${j.tapIn}, no tap out recorded`;
  const checked = late != null
    ? `${late} min late, over the ${j.threshold} min ${j.line === 'Elizabeth' ? 'Elizabeth line' : 'Tube'} limit`
    : 'Maximum fare charged, so you can claim it back';

  if (j.live) return liveStops(j, c, tapped, checked);

  if (j.status === 'none') {
    return [
      { title: 'Delayed', detail: tapped, state: 'done' },
      { title: 'Checked', detail: j.note, state: 'stopped' },
    ];
  }

  // How far along the line each status has got: 0 = Delayed … 4 = Saved
  const reached = { eligible: 2, claimed: 3, paid: 5 }[j.status];
  const stateOf = (i) => (i < reached ? 'done' : i === reached ? 'current' : 'todo');

  return [
    { title: 'Delayed', detail: tapped },
    { title: 'Checked', detail: checked },
    { title: 'Claimed',
      detail: j.claimDate ? `Sent to TfL ${j.claimDate} · single fare ${money(j.amount)}` : 'Waiting 48 h in case TfL refunds you automatically' },
    { title: 'Paid',
      detail: j.paidDate ? `Back on your card ${j.paidDate}` : j.claimDate ? 'TfL is reviewing it. This can take up to 10 working days.' : 'TfL pays it back to your card' },
    { title: 'Saved',
      detail: j.paidDate ? `Moved to ${j.pot}` : `Moved to ${j.pot} automatically when it lands` },
  ].map((stop, i) => ({ ...stop, state: stateOf(i) }));
}

// The live journey's stops follow the real claim's status.
function liveStops(j, c, tapped, checked) {
  const status = c?.status;
  const pot = c ? potName(c.potId) : 'the pot you choose';
  const list = [
    { title: 'Delayed', detail: tapped, state: 'done' },
    { title: 'Checked', detail: checked, state: 'done' },
  ];

  if (!status) {
    list.push({ title: 'Claimed', detail: 'Ready when you are', state: 'current' });
  } else if (status === 'sending') {
    list.push({ title: 'Claimed', detail: 'Sending to TfL…', state: 'current' });
  } else {
    list.push({ title: 'Claimed', detail: `Received by TfL at ${c.receivedAt}${c.claimId ? ` · ref ${c.claimId}` : ''}`, state: 'done' });
  }

  if (status === 'received' || status === 'under_review') {
    list.push({ title: 'Paid', detail: 'TfL is checking its records', state: 'current' });
  } else if (status === 'approved') {
    list.push({ title: 'Paid', detail: `${money(j.amount)} back to your card ending ${c.last4}`, state: 'done' });
  } else if (status === 'rejected') {
    list.push({ title: 'Paid', detail: c.message, state: 'stopped' });
    return list; // the line ends here
  } else {
    list.push({ title: 'Paid', detail: 'TfL pays it back to your card', state: 'todo' });
  }

  list.push(status === 'approved'
    ? { title: 'Saved', detail: `Moved to ${pot}`, state: 'done' }
    : { title: 'Saved', detail: `Moved to ${pot} when it lands`, state: 'todo' });
  return list;
}

const STATE_WORD = { done: 'Done', current: 'Happening now', todo: 'Coming up', stopped: 'Stopped here' };
const STATE_ICON = { done: '✓', current: '', todo: '', stopped: '!' };

function routeHtml(j, c) {
  const items = stops(j, c).map((s) => `<li class="route-stop is-${s.state}"${s.state === 'current' ? ' aria-current="step"' : ''}>
      <span class="route-dot" aria-hidden="true">${STATE_ICON[s.state]}</span>
      <span class="route-text">
        <span class="route-title">${s.title}${s.state === 'current' ? ' <span class="route-now">Now</span>' : ''}</span>
        <span class="route-detail"><span class="visually-hidden">${STATE_WORD[s.state]}. </span>${esc(s.detail)}</span>
      </span>
    </li>`).join('');

  return `<section class="refund-card" aria-labelledby="route-heading">
    <h2 id="route-heading" class="refund-card-title">Your refund, step by step</h2>
    <ol class="route">${items}</ol>
  </section>`;
}

// ---------- journey details ----------

const lineLabel = (name) => (name === 'DLR' ? 'DLR' : `${name} line`);

// "Highbury & Islington → Oxford Circus" → ["Highbury & Islington", "Oxford Circus"]
function fromTo(j) {
  if (j.from) return [j.from, j.to];
  const [from, to] = j.route.split(' → ');
  return [from.replace(', no tap out', ''), to || 'No tap out'];
}

const staticField = (label, value) => `<div class="jd-field">
    <span class="jd-label">${label}</span>
    <span class="jd-value">${esc(value)}</span>
  </div>`;

// Read-only version: every journey, and the live one after it's sent.
function detailsHtml(j, c) {
  const [from, to] = fromTo(j);
  const late = c?.late != null ? Number(c.late) : j.mins != null ? j.mins - j.usual : null;
  const lines = c?.lines
    ? c.lines.map((id) => LINE_CHOICES.find((l) => l.id === id).name).join(' and ') + (c.lines.length > 1 ? ' lines' : ' line')
    : lineLabel(j.line);

  return `<section class="refund-card" aria-labelledby="details-heading">
    <h2 id="details-heading" class="bt-kicker jd-heading">Journey details</h2>
    <div class="jd-grid">
      ${staticField('Date', j.date)}
      ${staticField('Line', lines)}
      ${staticField('From', from)}
      ${staticField('To', to)}
      ${staticField('Started at', j.tapIn)}
      ${staticField('Minutes late', late == null ? 'No tap out' : late > 0 ? `${late} min` : 'On time')}
    </div>
    ${j.cause ? `<p class="jd-cause"><strong>Cause:</strong> ${esc(j.cause)}</p>` : ''}
  </section>`;
}

// Editable version, on the claim screen: only the lines and minutes late can change.
function detailsFormHtml(j, d) {
  const [from, to] = fromTo(j);
  const measured = j.mins - j.usual;
  const chips = LINE_CHOICES.map((l) => `<label class="jd-chip">
      <input type="checkbox" name="lines" value="${l.id}" ${d.lines.includes(l.id) ? 'checked' : ''}>
      ${l.name}
    </label>`).join('');

  return `<section class="refund-card" aria-labelledby="details-heading">
    <h2 id="details-heading" class="bt-kicker jd-heading">Journey details</h2>
    <p class="jd-intro">Filled in from your taps. Change the line or minutes late if they're wrong.</p>
    <div class="jd-grid">
      ${staticField('Date', j.date)}
      <fieldset class="jd-field">
        <legend class="jd-label">Lines</legend>
        <div class="jd-chips">${chips}</div>
      </fieldset>
      ${staticField('From', from)}
      ${staticField('To', to)}
      ${staticField('Started at', j.tapIn)}
      <div class="jd-field">
        <label class="jd-label" for="jd-late">Minutes late</label>
        <input class="jd-input" id="jd-late" name="late" type="text" inputmode="numeric" autocomplete="off"
          placeholder="e.g. 25" value="${esc(d.late)}" aria-describedby="jd-late-hint">
        <span class="jd-hint" id="jd-late-hint">Your taps say ${measured} min</span>
      </div>
    </div>
  </section>`;
}

// ---------- "Checked for you": re-checked every time you change the details ----------

function checkClaim(j, d) {
  const items = [{ ok: true, text: "Within TfL's 28-day claim window" }];

  // Minutes late
  const raw = d.late.trim();
  const late = Number(raw);
  if (raw === '') {
    items.push({ ok: false, field: 'late', text: 'Enter how many minutes late you were' });
  } else if (!/^\d+$/.test(raw)) {
    items.push({ ok: false, field: 'late', text: 'Minutes late should be a whole number, like 25' });
  } else if (late > j.mins) {
    items.push({ ok: false, field: 'late', text: `${late} min is longer than your whole journey (${j.mins} min from your taps)` });
  } else if (late < j.threshold) {
    items.push({ ok: false, field: 'late', text: `${late} min late. Tube refunds start at ${j.threshold} min` });
  } else {
    items.push({ ok: true, text: `${late} min late, over the ${j.threshold} min Tube limit` });
  }

  // Lines: at least one, and TfL must have reported a delay on one of them
  const chosen = LINE_CHOICES.filter((l) => d.lines.includes(l.id));
  const cause = chosen.find((l) => l.reported);
  if (!chosen.length) {
    items.push({ ok: false, field: 'lines', text: 'Choose the line you were on' });
  } else if (cause) {
    items.push({ ok: true, text: `TfL reported ${cause.reported} on the ${cause.name} line, which is within their control` });
  } else {
    items.push({ ok: false, field: 'lines', text: `TfL reported no delays on the ${chosen.map((l) => l.name).join(' or ')} line at ${j.tapIn}` });
  }

  return { items, ok: items.every((i) => i.ok), problem: items.find((i) => !i.ok) };
}

function checksListHtml(result) {
  return result.items.map((i) => `<li class="${i.ok ? '' : 'is-problem'}">
      <span class="claim-tick ${i.ok ? '' : 'is-bad'}" aria-hidden="true">${i.ok ? '✓' : '!'}</span>
      <span><span class="visually-hidden">${i.ok ? 'Passed: ' : 'Problem: '}</span>${esc(i.text)}</span>
    </li>`).join('');
}

// ---------- the claim screen (live journey, not sent yet) ----------

function getDraft(j) {
  if (!drafts[j.id]) drafts[j.id] = { late: String(j.mins - j.usual), lines: [j.apiLine], potId: pots[0].id };
  return drafts[j.id];
}

function claimFormHtml(j) {
  const d = getDraft(j);

  const potOptions = pots.map((p) => `<label class="pot-option">
      <input type="radio" name="pot" value="${p.id}" ${p.id === d.potId ? 'checked' : ''}>
      <span class="bt-bullet" aria-hidden="true" style="--line: var(${p.colour})">${p.letter}</span>
      <span class="pot-option-text">
        <span class="pot-option-name">${esc(p.name)}</span>
        <span class="pot-option-note">${esc(potNote(p))}</span>
      </span>
    </label>`).join('');

  return `<form class="claim-form" id="claim-form" novalidate>
      ${detailsFormHtml(j, d)}

      <section class="refund-card" aria-labelledby="checks-heading">
        <h2 id="checks-heading" class="refund-card-title">Checked for you</h2>
        <ul class="claim-checks" id="claim-checks" aria-live="polite">${checksListHtml(checkClaim(j, d))}</ul>
      </section>

      <div class="refund-card">
        <fieldset class="pot-picker">
          <legend class="refund-card-title">Where should the ${money(j.amount)} go?</legend>
          <div class="pot-options">${potOptions}</div>
        </fieldset>
      </div>

      <label class="claim-consent">
        <input type="checkbox" name="consent" id="claim-consent">
        <span>Send my name, email, card token and this journey to TfL so Backtrack can claim for me.</span>
      </label>
      <p class="claim-error" id="claim-error" role="alert" hidden></p>

      <button type="submit" class="bt-btn claim-submit">Send claim to TfL</button>
      <p class="claim-small">TfL decides every claim using its own records.</p>
    </form>`;
}

// ---------- money at the bottom ----------

function moneyBarHtml(j, c) {
  if (j.live) {
    if (!c || c.status === 'sending' || c.status === 'rejected') return '';
    const pot = potName(c.potId);
    return c.status === 'approved'
      ? `<div class="refund-money">
          <span><strong class="refund-amount">${money(j.amount)}</strong><span class="refund-money-sub">saved to ${esc(pot)}</span></span>
          <a class="bt-btn refund-money-btn" href="#/pot">Open pot</a>
        </div>`
      : `<div class="refund-money">
          <span><strong class="refund-amount">${money(j.amount)}</strong><span class="refund-money-sub">on its way to ${esc(pot)}</span></span>
        </div>`;
  }
  if (j.status === 'eligible' || j.status === 'claimed') {
    return `<div class="refund-money">
      <span><strong class="refund-amount">${money(j.amount)}</strong><span class="refund-money-sub">on its way to ${esc(j.pot)}</span></span>
      <button type="button" class="bt-btn bt-btn--ghost refund-money-btn" data-soon="Changing pot">Change pot</button>
    </div>`;
  }
  if (j.status === 'paid') {
    return `<div class="refund-money">
      <span><strong class="refund-amount">${money(j.amount)}</strong><span class="refund-money-sub">saved to ${esc(j.pot)}</span></span>
      <a class="bt-btn refund-money-btn" href="#/pot">Open pot</a>
    </div>`;
  }
  return '';
}

// Plain-English rules, shown when a journey isn't refundable.
function rulesHtml() {
  return `<details class="refund-card refund-rules">
    <summary>What counts for a refund?</summary>
    <p>TfL refunds the single fare when you're 15 minutes late on the Tube or DLR, or 30 minutes late on the Elizabeth line or Overground.</p>
    <p>It doesn't count when the delay is caused by strikes, engineering works, bad weather, security alerts or someone being taken ill.</p>
  </details>`;
}

// ---------- sending the claim ----------

// Redraws the page (only if it's still on screen) and moves focus to the headline,
// so screen readers hear the new status.
function rerender() {
  if (!root || location.hash !== `#/journey/${currentId}`) return;
  root.innerHTML = page.render(currentId);
  page.afterRender(root);
  const box = root.querySelector('.refund-headline');
  if (box) {
    box.tabIndex = -1;
    box.focus({ preventScroll: true });
  }
}

// Updates the claim and the journey (so Home and Journeys show the new status too).
function applyClaim(j, claim) {
  const c = claims[j.id];
  c.status = claim.status;
  c.claimId = claim.id || c.claimId;
  if (!c.receivedAt) c.receivedAt = timeNow(claim.createdAt);
  j.pot = potName(c.potId);

  if (claim.status === 'approved') {
    j.status = 'paid';
    j.amount = claim.decision?.refund?.amount ?? j.amount;
    c.last4 = claim.decision?.refund?.last4 || '4821';
    j.note = `${money(j.amount)} back. Moved to ${j.pot}.`;
    const pot = findPot(c.potId);
    if (pot) pot.saved += j.amount;
  } else if (claim.status === 'rejected') {
    j.status = 'none';
    c.message = claim.decision?.message || "TfL's records don't support a refund for this journey.";
    j.note = c.message;
  } else {
    j.status = 'claimed';
    j.note = "Claim sent to TfL. We'll tell you when it lands.";
  }
  rerender();
}

// Real claim through the bank server. Sends the minutes late you entered.
async function sendClaim(j) {
  try {
    const draft = await api('/api/tfl-claims/draft', { method: 'POST', body: { transactionId: j.txnId } });
    const journey = {
      ...draft.prefill.journey,
      line: j.apiLine, from: j.from, to: j.to, plannedStart: j.tapIn,
      delayMinutes: Number(claims[j.id].late),
    };
    const claim = await api('/api/tfl-claims', {
      method: 'POST',
      body: { draftId: draft.draftId, journey, consent: { accepted: true } },
    });
    applyClaim(j, claim);
    pollClaim(j, claim.id);
  } catch (err) {
    console.warn('Bank API not available, using demo mode:', err.message);
    demoClaim(j);
  }
}

// Checks the claim every 1.5 s until TfL decides.
function pollClaim(j, claimId) {
  setTimeout(async () => {
    try {
      const claim = await api(`/api/tfl-claims/${encodeURIComponent(claimId)}`);
      if (claim.status !== claims[j.id].status) applyClaim(j, claim);
      if (claim.status !== 'approved' && claim.status !== 'rejected') pollClaim(j, claimId);
    } catch (err) {
      console.warn('Could not check the claim:', err.message);
    }
  }, 1500);
}

// Same steps as the real flow, on a timer. Used when the bank server isn't running.
function demoClaim(j) {
  const id = 'SDR-DEMO';
  setTimeout(() => applyClaim(j, { id, status: 'received' }), 700);
  setTimeout(() => applyClaim(j, { id, status: 'under_review' }), 3000);
  setTimeout(() => applyClaim(j, { id, status: 'approved', decision: { refund: { amount: j.amount, last4: '4821' } } }), 8000);
}

// ---------- page ----------

const page = {
  title: 'Refund',
  tab: 'journeys',

  render(id) {
    currentId = id;
    const j = findJourney(id) || journeys[0];
    const c = claims[j.id];
    const h = headline(j, c);
    const showForm = j.live && !c;

    return `<main>
        <a class="back-link" href="#/journeys" data-back>← Back</a>
        <header class="page-head">
          <h1 class="refund-title">${esc(j.route)}</h1>
          <p class="page-intro">${esc(j.line)} · ${esc(j.date)} · tapped in ${esc(j.tapIn)}</p>
        </header>

        <section class="refund-headline is-${h.tone}" role="status">
          <span class="refund-headline-icon" aria-hidden="true">${h.icon}</span>
          <span><strong>${h.title}</strong><span class="refund-headline-body">${h.body}</span></span>
        </section>

        ${showForm ? claimFormHtml(j) : detailsHtml(j, c)}
        ${j.status !== 'ontime' ? routeHtml(j, c) : ''}
        ${!j.live && j.status === 'none' ? rulesHtml() : ''}
        ${moneyBarHtml(j, c)}
      </main>`;
  },

  afterRender(el) {
    root = el;

    // "Back" returns to wherever you came from (Home or Journeys).
    el.querySelector('[data-back]').addEventListener('click', (e) => {
      if (history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });

    const form = el.querySelector('#claim-form');
    if (!form) return;

    const j = findJourney(currentId);
    const d = getDraft(j);
    const lateInput = form.elements.late;
    const error = el.querySelector('#claim-error');
    const checksList = el.querySelector('#claim-checks');
    let lastChecks = checksList.innerHTML;

    // Re-check after every change, so "Checked for you" always matches what's typed.
    function recheck() {
      d.late = lateInput.value;
      d.lines = [...form.querySelectorAll('input[name="lines"]:checked')].map((box) => box.value);
      d.potId = form.elements.pot.value;
      const result = checkClaim(j, d);
      const html = checksListHtml(result);
      if (html !== lastChecks) { // only update when something changed, so screen readers aren't flooded
        checksList.innerHTML = html;
        lastChecks = html;
      }
      lateInput.setAttribute('aria-invalid', result.items.some((i) => i.field === 'late') ? 'true' : 'false');
      if (result.ok) error.hidden = true;
      return result;
    }
    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const result = recheck();
      const consent = el.querySelector('#claim-consent');

      if (!result.ok) {
        error.textContent = `${result.problem.text}.`;
        error.hidden = false;
        (result.problem.field === 'late' ? lateInput : form.querySelector('input[name="lines"]')).focus();
        return;
      }
      if (!consent.checked) {
        error.textContent = 'Tick the box so we can send the claim for you.';
        error.hidden = false;
        consent.focus();
        return;
      }

      claims[j.id] = { status: 'sending', potId: d.potId, late: d.late.trim(), lines: [...d.lines] };
      document.getElementById('screen')?.scrollTo(0, 0);
      rerender();
      sendClaim(j);
    });
  },
};

export default page;