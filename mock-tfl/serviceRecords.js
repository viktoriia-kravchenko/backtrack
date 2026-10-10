'use strict';
// Fake TfL service records. Dates are relative to today so the demo always works.
// Times are London local time.

const { daysAgo } = require('../lib/dates');

function buildServiceRecords() {
  return [
    {
      line: 'victoria', date: daysAgo(2), from: '07:50', to: '09:40',
      severity: 6, severityDescription: 'Severe Delays', category: 'RealTime',
      reason: 'Victoria line: Severe delays due to an earlier signal failure at Oxford Circus. Tickets are being accepted on London Buses.',
    },
    {
      line: 'northern', date: daysAgo(5), from: '18:05', to: '19:15',
      severity: 9, severityDescription: 'Minor Delays', category: 'RealTime',
      reason: 'Northern line: Minor delays due to a customer incident at Camden Town.',
    },
    {
      line: 'victoria', date: daysAgo(9), from: '05:30', to: '23:59',
      severity: 6, severityDescription: 'Severe Delays', category: 'RealTime',
      reason: 'Victoria line: Severe delays due to strike action. Please allow extra time.',
    },
    {
      line: 'elizabeth', date: daysAgo(12), from: '17:20', to: '19:00',
      severity: 6, severityDescription: 'Severe Delays', category: 'RealTime',
      reason: 'Elizabeth line: Severe delays between Paddington and Abbey Wood due to a faulty train at Bond Street.',
    },
    {
      line: 'victoria', date: daysAgo(40), from: '08:00', to: '09:30',
      severity: 6, severityDescription: 'Severe Delays', category: 'RealTime',
      reason: 'Victoria line: Severe delays due to a signal failure at Finsbury Park.',
    },
  ];
}

module.exports = { buildServiceRecords };
