/**
 * RUN ALL OCR & API TESTS VIA NODE / ELECTRON MAIN BUILD
 */

const path = require('path');

async function main() {
  console.log('====================================================');
  console.log('HENU OS / HENU AI — OCR INTEGRATION & SECURITY TESTS');
  console.log('====================================================\n');

  try {
    // 1. API Integration Tests
    const { runApiOcrIntegrationTests } = require('../dist/main/modules/henu-voucher-ocr/tests/apiOcrIntegration.test.js');
    const apiRes = await runApiOcrIntegrationTests();

    // 2. Existing Voucher OCR Core Tests
    const { runVoucherOcrTests } = require('../dist/main/modules/henu-voucher-ocr/tests/voucherOcr.test.js');
    const coreRes = await runVoucherOcrTests();

    console.log('\n====================================================');
    console.log(`TOTAL PASSED: ${apiRes.passed + coreRes.passed}`);
    console.log(`TOTAL FAILED: ${apiRes.failed + coreRes.failed}`);
    console.log('====================================================');

    if (apiRes.failed > 0 || coreRes.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

main();
