'use strict';
// Date helpers. Everything is in London time because that's what TfL uses.

const TZ = 'Europe/London';
const DAY_MS = 86_400_000;

/** Today's date in London as YYYY-MM-DD. */
function todayLondon(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Shift a YYYY-MM-DD date by a number of days. */
function shiftDate(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** London date n days before today, as YYYY-MM-DD. */
function daysAgo(n) {
  return shiftDate(todayLondon(), -n);
}

/** Whole days from date a to date b (b - a). */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === date;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert a timestamp from the TfL Unified API to a London date and HH:MM.
 * Real API values carry a UTC offset ("...Z"); the mock sends London local time without one.
 */
function toLondonParts(iso) {
  if (/(Z|[+-]\d\d:\d\d)$/.test(iso)) {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-CA', { timeZone: TZ }),
      time: d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  }
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

module.exports = { TZ, todayLondon, shiftDate, daysAgo, daysBetween, isValidDate, toMinutes, toLondonParts };
