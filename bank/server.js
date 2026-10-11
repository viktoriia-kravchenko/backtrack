'use strict';
// Bank backend. The browser only ever talks to this server. It:
//   - builds a prefilled claim draft from a TfL contactless transaction
//   - checks eligibility against TfL line status
//   - submits the claim (with the customer's consent) to the mock TfL refund API
//
//   GET  /api/me
//   GET  /api/transactions
//   POST /api/tfl-claims/draft    { transactionId }
//   POST /api/tfl-claims/check    { draftId, journey }
//   POST /api/tfl-claims          { draftId, journey, consent: { accepted: true } }
//   GET  /api/tfl-claims/:id

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRouter, sendJson, readJson, httpError } = require('../lib/http');
const { todayLondon, shiftDate, daysBetween } = require('../lib/dates');
const { CLAIM_WINDOW_DAYS, MODES, LINES, lineLabel, classifyCause, findDisruption } = require('../lib/rules');
const { validateJourney, cleanJourney } = require('../lib/validate');
const { createStore } = require('./data');
const { createLineStatusClient, createRefundClient, TflError } = require('./tflClient');

const DRAFT_TTL_MS = 30 * 60_000;
const CONSENT_STATEMENT = 'I agree to Kite Bank sending my name, email, card token and journey details to TfL to claim a service delay refund for me.';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/main.js': ['main.js', 'text/javascript; charset=utf-8'],
  '/backtrack.css': ['backtrack.css', 'text/css; charset=utf-8'],
  '/data.js': ['data.js', 'text/javascript; charset=utf-8'],
  '/api.js': ['api.js', 'text/javascript; charset=utf-8'],
  '/pages/loading.js': ['pages/loading.js', 'text/javascript; charset=utf-8'],
  '/pages/home.js': ['pages/home.js', 'text/javascript; charset=utf-8'],
  '/journeys.js': ['journeys.js', 'text/javascript; charset=utf-8'],
  '/pots-store.js': ['pots-store.js', 'text/javascript; charset=utf-8'],
  '/pages/pots.js': ['pages/pots.js', 'text/javascript; charset=utf-8'],
   '/pages/journeys.js': ['pages/journeys.js', 'text/javascript; charset=utf-8'],
  '/pages/refund.js': ['pages/refund.js', 'text/javascript; charset=utf-8'],
  '/pages/placeholder.js': ['pages/placeholder.js', 'text/javascript; charset=utf-8'],
    '/pages/lines.js': ['pages/lines.js', 'text/javascript; charset=utf-8'],
  '/components/navbar.js': ['components/navbar.js', 'text/javascript; charset=utf-8'],
  '/components/menu.js': ['components/menu.js', 'text/javascript; charset=utf-8'],
    '/logo.svg': ['logo.svg', 'image/svg+xml'],
  // Old Kite claim demo
  '/kite.html': ['kite.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  
};

function createBankServer({
  tflBaseUrl = process.env.MOCK_TFL_URL || 'http://localhost:4001',
  partnerKey = process.env.MOCK_TFL_PARTNER_KEY || 'hackathon-partner-key',
  unifiedApiBase = process.env.TFL_UNIFIED_API_BASE || tflBaseUrl,
  unifiedApiKey = process.env.TFL_APP_KEY,
} = {}) {
  const store = createStore();
  const lineStatus = createLineStatusClient({ baseUrl: unifiedApiBase, appKey: unifiedApiKey });
  const refunds = createRefundClient({ baseUrl: tflBaseUrl, partnerKey });
  const router = createRouter();

  const findCard = (id) => store.cards.find((c) => c.id === id);

  function publicTxn(t) {
    return {
      id: t.id,
      postedDate: t.postedDate,
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
      isTflContactless: t.isTflContactless,
      ...(t.isTflContactless ? { travelDate: shiftDate(t.postedDate, -1), claimIds: t.claimIds } : {}),
    };
  }

  function getDraft(draftId) {
    const draft = store.drafts.get(draftId);
    if (!draft || Date.now() - draft.createdAt > DRAFT_TTL_MS) {
      throw httpError(404, 'DRAFT_NOT_FOUND', 'This claim has expired. Please start again.');
    }
    return draft;
  }

  async function lookupDisruption(journey) {
    try {
      return { disruption: findDisruption(await lineStatus.disruptionsOn(journey.line, journey.travelDate), journey.plannedStart) };
    } catch {
      return { disruption: null, lookupFailed: true };
    }
  }

  /** Pre-check a journey against TfL's published rules so the customer knows what to expect. */
  async function assess(journey) {
    const checks = [];
    const mode = MODES[LINES[journey.line].mode];

    const age = daysBetween(journey.travelDate, todayLondon());
    if (age < 0) checks.push({ id: 'window', status: 'fail', message: 'That date is in the future.' });
    else if (age > CLAIM_WINDOW_DAYS) {
      checks.push({ id: 'window', status: 'fail', message: `This was ${age} days ago. TfL only accepts claims within ${CLAIM_WINDOW_DAYS} days.` });
    } else {
      const left = CLAIM_WINDOW_DAYS - age;
      checks.push({ id: 'window', status: 'pass', message: `Within the ${CLAIM_WINDOW_DAYS}-day claim window (${left} day${left === 1 ? '' : 's'} left).` });
    }

    if (journey.delayMinutes == null) {
      checks.push({ id: 'delay', status: 'todo', message: `How late were you? ${mode.label} delays need to be ${mode.thresholdMinutes} minutes or more.` });
    } else if (journey.delayMinutes < mode.thresholdMinutes) {
      checks.push({ id: 'delay', status: 'fail', message: `${mode.label} delays need to be ${mode.thresholdMinutes} minutes or more. You entered ${journey.delayMinutes}.` });
    } else {
      checks.push({ id: 'delay', status: 'pass', message: `${journey.delayMinutes} minutes meets the ${mode.thresholdMinutes}-minute ${mode.label} threshold.` });
    }

    const { disruption, lookupFailed } = await lookupDisruption(journey);
    let cause = null;
    if (lookupFailed) {
      checks.push({ id: 'cause', status: 'warn', message: "We couldn't reach TfL's status data. You can still claim; TfL checks its own records." });
    } else if (!disruption) {
      checks.push({ id: 'cause', status: 'warn', message: `TfL didn't report a disruption on the ${lineLabel(journey.line)} around ${journey.plannedStart}. You can still claim, but it may be rejected.` });
    } else {
      cause = classifyCause(disruption.reason);
      checks.push(cause.withinControl
        ? { id: 'cause', status: 'pass', message: `TfL reported: ${disruption.reason} Delays like this are usually refundable.` }
        : { id: 'cause', status: 'warn', message: `TfL reported: ${disruption.reason} ${cause.label} is outside TfL's control, so a refund is unlikely.` });
    }

    const blocked = checks.some((c) => c.status === 'fail');
    return {
      checks,
      likelyEligible: checks.every((c) => c.status === 'pass'),
      canSubmit: !blocked && journey.delayMinutes != null,
      disruption: disruption ? { ...disruption, withinControl: cause.withinControl } : null,
    };
  }

  /** Rank the customer's saved journeys by how likely each one is to be the delayed trip. */
  async function rankCandidates(travelDate) {
    const ranked = await Promise.all(store.savedJourneys.map(async (j) => {
      const { disruption } = await lookupDisruption({ line: j.line, travelDate, plannedStart: j.usualStart });
      const withinControl = disruption ? classifyCause(disruption.reason).withinControl : null;
      return {
        id: j.id,
        label: j.label,
        line: j.line,
        lineLabel: lineLabel(j.line),
        from: j.from,
        to: j.to,
        usualStart: j.usualStart,
        disruption: disruption ? { ...disruption, withinControl } : null,
        score: withinControl === true ? 0 : withinControl === false ? 1 : 2,
      };
    }));
    return ranked.sort((a, b) => a.score - b.score).map(({ score, ...rest }) => rest);
  }

  function parseJourney(input, opts) {
    const journey = cleanJourney(input);
    const errors = validateJourney(journey, opts);
    if (errors.length) throw httpError(400, 'INVALID_JOURNEY', 'Some journey details are missing or invalid', errors);
    return journey;
  }

  // --- static files -------------------------------------------------------
  for (const [route, [file, type]] of Object.entries(STATIC_FILES)) {
    router.get(route, (req, res) => {
      const data = fs.readFileSync(path.join(PUBLIC_DIR, file));
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(data);
    });
  }

  // --- API ----------------------------------------------------------------
  router.get('/api/me', (req, res) => {
    const { name, email } = store.profile;
    sendJson(res, 200, { name, email, cards: store.cards.map(({ id, label, last4 }) => ({ id, label, last4 })) });
  });

  router.get('/api/transactions', (req, res) => {
    sendJson(res, 200, store.transactions.map(publicTxn));
  });

  router.post('/api/tfl-claims/draft', async (req, res) => {
    const { transactionId } = await readJson(req);
    const txn = store.transactions.find((t) => t.id === transactionId);
    if (!txn) throw httpError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
    if (!txn.isTflContactless) throw httpError(422, 'NOT_A_TFL_CHARGE', 'Only TfL contactless charges can be claimed');

    const card = findCard(txn.cardId);
    const travelDate = shiftDate(txn.postedDate, -1);
    const candidates = await rankCandidates(travelDate);
    const best = candidates[0];
    const journey = { travelDate, line: best.line, from: best.from, to: best.to, plannedStart: best.usualStart, delayMinutes: null };

    const draftId = `drf_${crypto.randomUUID()}`;
    store.drafts.set(draftId, { id: draftId, txnId: txn.id, cardId: card.id, createdAt: Date.now(), claimId: null });

    sendJson(res, 201, {
      draftId,
      transaction: publicTxn(txn),
      prefill: {
        customer: { name: store.profile.name, email: store.profile.email },
        payment: { method: 'contactless', card: `${card.label} •••• ${card.last4}` },
        journey,
      },
      candidates,
      assessment: await assess(journey),
      lines: Object.keys(LINES).map((id) => ({ id, label: lineLabel(id), mode: LINES[id].mode })),
      consentStatement: CONSENT_STATEMENT,
    });
  });

  router.post('/api/tfl-claims/check', async (req, res) => {
    const body = await readJson(req);
    getDraft(body.draftId);
    const journey = parseJourney(body.journey, { allowMissingDelay: true });
    sendJson(res, 200, await assess(journey));
  });

  router.post('/api/tfl-claims', async (req, res) => {
    const body = await readJson(req);
    const draft = getDraft(body.draftId);
    if (body.consent?.accepted !== true) {
      throw httpError(400, 'CONSENT_REQUIRED', 'The customer must agree before we send anything to TfL');
    }
    const journey = parseJourney(body.journey);
    const card = findCard(draft.cardId);
    const txn = store.transactions.find((t) => t.id === draft.txnId);

    const payload = {
      partnerReference: draft.id,
      customer: { name: store.profile.name, email: store.profile.email },
      payment: { method: 'contactless', cardToken: card.token, last4: card.last4 },
      journey,
      consent: { accepted: true, givenAt: new Date().toISOString(), statement: CONSENT_STATEMENT },
    };

    try {
      // A draft makes at most one claim. Pressing the button twice returns the same claim.
      if (draft.claimId) {
        const { body: existing } = await refunds.get(draft.claimId);
        return sendJson(res, 200, existing);
      }
      // Same draft + same journey = same Idempotency-Key, so a retry after a network
      // timeout can't create a second claim at TfL.
      const journeyHash = crypto.createHash('sha256').update(JSON.stringify(journey)).digest('hex').slice(0, 16);
      const { status, body: claim } = await refunds.submit(payload, `${draft.id}:${journeyHash}`);
      draft.claimId = claim.id;
      store.claims.set(claim.id, { txnId: txn.id, draftId: draft.id });
      if (!txn.claimIds.includes(claim.id)) txn.claimIds.push(claim.id);
      sendJson(res, status, claim);
    } catch (err) {
      if (!(err instanceof TflError)) throw err;
      if (err.status === 401) throw httpError(502, 'TFL_AUTH_FAILED', "The bank couldn't authenticate with TfL");
      throw httpError(err.status, err.code, err.message, err.details);
    }
  });

  router.get('/api/tfl-claims/:id', async (req, res, { params }) => {
    if (!store.claims.has(params.id)) throw httpError(404, 'CLAIM_NOT_FOUND', 'Claim not found');
    try {
      const { body } = await refunds.get(params.id);
      sendJson(res, 200, body);
    } catch (err) {
      if (!(err instanceof TflError)) throw err;
      throw httpError(err.status === 401 ? 502 : err.status, err.code, err.message);
    }
  });

  return http.createServer(router.handle);
}

module.exports = { createBankServer };
