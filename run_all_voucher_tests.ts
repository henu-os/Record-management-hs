import { runVoucherOcrTests } from './src/modules/henu-voucher-ocr/tests/voucherOcr.test';
import { runApiOcrIntegrationTests } from './src/modules/henu-voucher-ocr/tests/apiOcrIntegration.test';

async function main() {
  console.log('=== RUNNING ALL VOUCHER OCR TESTS ===');
  const r1 = await runVoucherOcrTests();
  console.log(`Voucher OCR Unit Suite: ${r1.passed} passed, ${r1.failed} failed`);
  if (r1.failed > 0) {
    console.error('Errors:', r1.errors);
    process.exit(1);
  }

  const r2 = await runApiOcrIntegrationTests();
  console.log(`API OCR Integration Suite: ${r2.passed} passed, ${r2.failed} failed`);
  if (r2.failed > 0) {
    console.error('Errors:', r2.errors);
    process.exit(1);
  }

  console.log('ALL AUTOMATED TESTS PASSED (0 FAILURES)!');
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
