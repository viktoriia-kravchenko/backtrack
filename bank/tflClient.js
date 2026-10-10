'use strict';
// Clients for the two TfL-facing APIs the bank uses.
//
// 1. Line status: the real TfL Unified API has this endpoint, and the mock copies its shape.
//    Point TFL_UNIFIED_API_BASE at https://api.tfl.gov.uk to use live data. It may not
//    return disruptions from past days, which is why the demo uses the mock by default.
// 2. Refund claims: MOCK ONLY. TfL has no public API for this.

const { toLondonParts } = require('../lib/dates');

class TflError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `TfL API returned ${status}`);
    this.status = status;
    this.code = body?.error?.code || 'TFL_ERROR';
    this.details = body?.error?.details;
  }
}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  } catch (err) {
    const e = new TflError(502, { error: { code: 'TFL_UNAVAILABLE', message: 'Could not reach TfL. Please try again.' } });
    e.cause = err;
    throw e;
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new TflError(res.status, body);
  return { status: res.status, body };
}

function createLineStatusClient({ baseUrl, appKey, cacheMs = 5 * 60_000 }) {
  const cache = new Map();

  /** Disruptions on a line on a London date: [{ severityDescription, reason, from: 'HH:MM', to: 'HH:MM' }] */
  async function disruptionsOn(lineId, date) {
    const key = `${lineId}|${date}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < cacheMs) return hit.value;

    const query = appKey ? `?app_key=${encodeURIComponent(appKey)}` : '';
    const url = `${baseUrl}/Line/${encodeURIComponent(lineId)}/Status/${date}T00:00:00/to/${date}T23:59:59${query}`;
    const { body } = await request(url);

    const value = [];
    for (const line of Array.isArray(body) ? body : []) {
      for (const status of line.lineStatuses || []) {
        if (status.statusSeverity === 10) continue; // Good Service
        for (const period of status.validityPeriods || []) {
          const start = toLondonParts(period.fromDate);
          const end = toLondonParts(period.toDate);
          if (start.date > date || end.date < date) continue;
          value.push({
            severityDescription: status.statusSeverityDescription,
            reason: status.reason || status.disruption?.description || '',
            from: start.date < date ? '00:00' : start.time,
            to: end.date > date ? '23:59' : end.time,
          });
        }
      }
    }
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  return { disruptionsOn };
}

function createRefundClient({ baseUrl, partnerKey }) {
  const headers = { Authorization: `Bearer ${partnerKey}`, 'Content-Type': 'application/json' };
  return {
    submit: (payload, idempotencyKey) => request(`${baseUrl}/v1/service-delay-refunds`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),
    get: (claimId) => request(`${baseUrl}/v1/service-delay-refunds/${encodeURIComponent(claimId)}`, { headers }),
  };
}

module.exports = { createLineStatusClient, createRefundClient, TflError };
