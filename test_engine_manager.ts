import fs from 'fs';
import { HenuAiEngineManager } from './src/main/services/HenuAiEngineManager';
import { OcrRouter } from './src/modules/henu-voucher-ocr/ocr/OcrRouter';

async function testMain() {
  console.log('--- TESTING HENU AI ENGINE MANAGER ---');
  const manager = HenuAiEngineManager.getInstance();
  const status = manager.getStatusReport();
  console.log('Status Report:', JSON.stringify(status, null, 2));

  const imgBytes = fs.readFileSync('g:/Astro/testvoucher.jpeg');
  const b64 = imgBytes.toString('base64');

  console.log('Dispatching processVoucher to USB AI Brain...');
  const t0 = Date.now();
  const usbResult = await manager.processVoucher({
    base64Image: b64,
    fileName: 'testvoucher.jpeg',
    languages: ['eng'],
  });
  console.log(`Processing complete in ${(Date.now() - t0) / 1000}s!`);
  console.log('USB Result Status:', usbResult.status);
  console.log('Voucher Output:', JSON.stringify(usbResult.voucher, null, 2));

  // Map to record
  const record = OcrRouter.mapUsbResultToRecord(
    usbResult,
    'testvoucher.jpeg',
    1,
    1,
    `data:image/jpeg;base64,${b64}`
  );

  console.log('--- FINAL MAPPED 26-FIELD RECORD ---');
  for (const [k, v] of Object.entries(record.fields)) {
    console.log(`${k}: norm=${JSON.stringify(v.normalizedValue)}, raw=${JSON.stringify(v.rawValue)}, conf=${v.confidence}%, ev=${JSON.stringify(v.evidence)}`);
  }

  console.log('Mathematical Validation Issues:', record.validationIssues);
  console.log('Review Required:', record.reviewRequired);
  console.log('Overall Confidence:', record.overallConfidence);
}

testMain().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
