'use strict';
// Starts the mock TfL API and the bank app together.

const { createMockTflServer } = require('./mock-tfl/server');
const { createBankServer } = require('./bank/server');

const TFL_PORT = Number(process.env.MOCK_TFL_PORT || 4001);
const BANK_PORT = Number(process.env.PORT || 3000);

createMockTflServer().listen(TFL_PORT, () => {
  console.log(`Mock TfL API  http://localhost:${TFL_PORT}`);
});

createBankServer({ tflBaseUrl: process.env.MOCK_TFL_URL || `http://localhost:${TFL_PORT}` }).listen(BANK_PORT, () => {
  console.log(`Banking app   http://localhost:${BANK_PORT}`);
});
