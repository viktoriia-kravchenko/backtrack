'use strict';
const { isValidDate } = require('./dates');
const { LINES } = require('./rules');

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validStation(value) {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 80;
}

/** Validate a journey. Returns a list of { field, message } (empty when valid). */
function validateJourney(journey, { allowMissingDelay = false } = {}) {
  if (!journey || typeof journey !== 'object') return [{ field: 'journey', message: 'is required' }];
  const errors = [];
  if (!isValidDate(journey.travelDate)) errors.push({ field: 'journey.travelDate', message: 'must be a date like 2026-10-08' });
  if (!Object.hasOwn(LINES, journey.line ?? '')) errors.push({ field: 'journey.line', message: 'must be a TfL rail line id, e.g. victoria' });
  if (!validStation(journey.from)) errors.push({ field: 'journey.from', message: 'must be a station name (2-80 characters)' });
  if (!validStation(journey.to)) errors.push({ field: 'journey.to', message: 'must be a station name (2-80 characters)' });
  if (!TIME_RE.test(journey.plannedStart ?? '')) errors.push({ field: 'journey.plannedStart', message: 'must be a time like 08:10' });
  const delayMissing = journey.delayMinutes === null || journey.delayMinutes === undefined;
  if (!(allowMissingDelay && delayMissing)) {
    if (!Number.isInteger(journey.delayMinutes) || journey.delayMinutes < 1 || journey.delayMinutes > 600) {
      errors.push({ field: 'journey.delayMinutes', message: 'must be a whole number of minutes between 1 and 600' });
    }
  }
  return errors;
}

/** Normalise user-entered journey fields before validation. */
function cleanJourney(journey = {}) {
  const delay = journey.delayMinutes;
  return {
    travelDate: journey.travelDate,
    line: journey.line,
    from: typeof journey.from === 'string' ? journey.from.trim() : journey.from,
    to: typeof journey.to === 'string' ? journey.to.trim() : journey.to,
    plannedStart: journey.plannedStart,
    delayMinutes: delay === '' || delay === undefined ? null : typeof delay === 'string' ? Number(delay) : delay,
  };
}

module.exports = { validateJourney, cleanJourney, EMAIL_RE };
