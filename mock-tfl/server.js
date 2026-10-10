'use strict';
// MOCK TfL API. TfL does not offer a public API for refund claims. This is what one
// could look like if a bank partnered with TfL. Nothing here talks to the real TfL.
//
//   GET  /Line/:ids/Status/:start/to/:end   same shape as the real Unified API endpoint
//   POST /v1/service-delay-refunds          submit a claim (partner key + Idempotency-Key)
//   GET  /v1/service-delay-refunds/:id      claim status: received -> under_review -> approved | rejected

const http = require('node:http');
const crypto = require('node:crypto');
const { createRouter, sendJson, readJson, httpError } = require('../lib/http');
const { todayLondon, daysBetween, shiftDate } = require('../lib/dates');
const { CLAIM_WINDOW_DAYS, MODES, LINES, lineLabel, classifyCause, findDisruption } = require('../lib/rules');
const { validateJourney, EMAIL_RE } = require('../lib/validate');
const { buildServiceRecords } = require('./serviceRecords');

// Placeholder refund amounts. TfL refunds the single pay-as-you-go fare for the journey;
// these are NOT real fares.
const MOCK_SINGLE_FARE_GBP = { tube: 2.9, dlr: 2.9, overground: 2.9, 'elizabeth-line': 3.2 };

function validateClaimBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return [{ field: 'body', message: 'is required' }];
  const { customer, payment, consent } = body;
  if (typeof customer?.name !== 'string' || customer.name.trim().length < 2) errors.push({ field: 'customer.name', message: 'is required' });
  if (typeof customer?.email !== 'string' || !EMAIL_RE.test(customer.email)) errors.push({ field: 'customer.email', message: 'must be an email address' });
  if (payment?.method !== 'contactless') errors.push({ field: 'payment.method', message: 'must be "contactless"' });
  if (typeof payment?.cardToken !== 'string' || !payment.cardToken.startsWith('tok_')) {
    errors.push({ field: 'payment.cardToken', message: 'must be a card token (never send the card number)' });
  }
  if (!/^\d{4}$/.test(payment?.last4 ?? '')) errors.push({ field: 'payment.last4', message: 'must be 4 digits' });
  if (consent?.accepted !== true || typeof consent?.givenAt !== 'string') {
    errors.push({ field: 'consent', message: 'the customer must have agreed to the claim being made on their behalf' });
  }
  errors.push(...validateJourney(body.journey));
  return errors;
}

function decide(journey, mode, last4) {
  const records = buildServiceRecords().filter((r) => r.line === journey.line && r.date === journey.travelDate);
  const record = findDisruption(records, journey.plannedStart);
  if (!record) {
    return {
      status: 'rejected',
      reasonCode: 'NO_DISRUPTION_RECORDED',
      message: `Our records don't show a delay on the ${lineLabel(journey.line)} around ${journey.plannedStart} on ${journey.travelDate}.`,
    };
  }
  const cause = classifyCause(record.reason);
  if (!cause.withinControl) {
    return {
      status: 'rejected',
      reasonCode: 'OUTSIDE_TFL_CONTROL',
      message: `${cause.label} caused this delay, which is outside our control, so we can't refund it.`,
      cause: cause.cause,
    };
  }
  return {
    status: 'approved',
    message: 'We have refunded the single fare for your delayed journey.',
    refund: {
      amount: MOCK_SINGLE_FARE_GBP[mode],
      currency: 'GBP',
      method: 'contactless_card',
      last4,
      expectedBy: shiftDate(todayLondon(), 3),
    },
  };
}

function createMockTflServer({
  partnerKey = process.env.MOCK_TFL_PARTNER_KEY || 'hackathon-partner-key',
  // Real reviews take up to 10 working days. The mock compresses that for demos.
  decisionDelayMs = Number(process.env.DECISION_DELAY_MS || 8000),
} = {}) {
  const claims = new Map(); // claimId -> claim
  const idempotency = new Map(); // Idempotency-Key -> { bodyHash, claimId }
  const router = createRouter();

  function requirePartner(req) {
    const auth = req.headers.authorization || '';
    const token = Buffer.from(auth.startsWith('Bearer ') ? auth.slice(7) : '');
    const expected = Buffer.from(partnerKey);
    if (token.length !== expected.length || !crypto.timingSafeEqual(token, expected)) {
      throw httpError(401, 'UNAUTHORIZED', 'Missing or invalid partner API key');
    }
  }

  function present(claim) {
    const iso = (t) => new Date(t).toISOString();
    const elapsed = Date.now() - claim.createdAt;
    const reviewAt = claim.createdAt + Math.round(decisionDelayMs * 0.3);
    const decidedAt = claim.createdAt + decisionDelayMs;
    const timeline = [{ status: 'received', at: iso(claim.createdAt) }];
    let status = 'received';
    if (elapsed >= decisionDelayMs * 0.3) {
      status = 'under_review';
      timeline.push({ status, at: iso(reviewAt) });
    }
    const decided = elapsed >= decisionDelayMs;
    if (decided) {
      status = claim.decision.status;
      timeline.push({ status, at: iso(decidedAt) });
    }
    return {
      id: claim.id,
      status,
      partnerReference: claim.partnerReference,
      journey: claim.journey,
      payment: claim.payment,
      createdAt: iso(claim.createdAt),
      timeline,
      ...(decided ? { decision: claim.decision } : { estimatedDecisionBy: iso(decidedAt) }),
    };
  }

  // Same URL and response shape as the real Unified API, backed by fake records.
  router.get('/Line/:ids/Status/:start/to/:end', (req, res, { params }) => {
    const ids = params.ids.split(',').map((s) => s.trim().toLowerCase()).filter((id) => Object.hasOwn(LINES, id));
    const start = params.start.slice(0, 10);
    const end = params.end.slice(0, 10);
    const records = buildServiceRecords().filter((r) => ids.includes(r.line) && r.date >= start && r.date <= end);
    sendJson(res, 200, ids.map((id) => {
      const recs = records.filter((r) => r.line === id);
      return {
        id,
        name: LINES[id].name,
        modeName: LINES[id].mode,
        lineStatuses: recs.length
          ? recs.map((r) => ({
            statusSeverity: r.severity,
            statusSeverityDescription: r.severityDescription,
            reason: r.reason,
            validityPeriods: [{ fromDate: `${r.date}T${r.from}:00`, toDate: `${r.date}T${r.to}:00`, isNow: false }],
            disruption: { category: r.category, categoryDescription: r.category, description: r.reason },
          }))
          : [{ statusSeverity: 10, statusSeverityDescription: 'Good Service', validityPeriods: [] }],
      };
    }));
  });

  router.post('/v1/service-delay-refunds', async (req, res) => {
    requirePartner(req);
    const key = req.headers['idempotency-key'];
    if (!key || key.length > 100) {
      throw httpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send a unique Idempotency-Key header (up to 100 characters)');
    }
    const body = await readJson(req);
    // Compare what the claim is about, not timestamps, so an honest retry matches.
    const { customer, payment: pay, journey: jny } = body ?? {};
    const bodyHash = crypto.createHash('sha256').update(JSON.stringify({ customer, pay, jny })).digest('hex');
    const seen = idempotency.get(key);
    if (seen) {
      if (seen.bodyHash !== bodyHash) {
        throw httpError(422, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request');
      }
      return sendJson(res, 200, present(claims.get(seen.claimId)));
    }

    const errors = validateClaimBody(body);
    if (errors.length) throw httpError(400, 'INVALID_REQUEST', 'The claim has missing or invalid fields', errors);

    const { journey, payment } = body;
    const mode = LINES[journey.line].mode;
    const age = daysBetween(journey.travelDate, todayLondon());
    if (age < 0) throw httpError(422, 'JOURNEY_IN_FUTURE', 'You can only claim for journeys you have already made');
    if (age > CLAIM_WINDOW_DAYS) {
      throw httpError(422, 'CLAIM_WINDOW_EXPIRED', `Claims must be made within ${CLAIM_WINDOW_DAYS} days of the delay. This journey was ${age} days ago.`);
    }
    const { thresholdMinutes, label } = MODES[mode];
    if (journey.delayMinutes < thresholdMinutes) {
      throw httpError(422, 'DELAY_BELOW_THRESHOLD', `${label} delays must be ${thresholdMinutes} minutes or more to qualify.`);
    }
    const dupKey = [payment.cardToken, journey.travelDate, journey.line, journey.plannedStart].join('|');
    const duplicate = [...claims.values()].find((c) => c.dupKey === dupKey);
    if (duplicate) {
      throw httpError(409, 'DUPLICATE_CLAIM', `A claim for this journey already exists (${duplicate.id}).`);
    }

    const claim = {
      id: `SDR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      dupKey,
      createdAt: Date.now(),
      partnerReference: typeof body.partnerReference === 'string' ? body.partnerReference.slice(0, 100) : null,
      journey: { ...journey, mode },
      payment: { method: 'contactless', last4: payment.last4 },
      decision: decide(journey, mode, payment.last4),
    };
    claims.set(claim.id, claim);
    idempotency.set(key, { bodyHash, claimId: claim.id });
    sendJson(res, 201, present(claim), { Location: `/v1/service-delay-refunds/${claim.id}` });
  });

  router.get('/v1/service-delay-refunds/:id', (req, res, { params }) => {
    requirePartner(req);
    const claim = claims.get(params.id);
    if (!claim) throw httpError(404, 'CLAIM_NOT_FOUND', 'No claim with that id');
    sendJson(res, 200, present(claim));
  });

  return http.createServer(router.handle);
}

module.exports = { createMockTflServer };
