// ============================================================
// Test Suite: 13x19 Dual-Page Share Certificate Generator
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { ShareCertificateRenderer, SIZE_13X19_W, SIZE_13X19_H, SAFE_MARGIN_075 } = require('../dist/main/services/renderers/ShareCertificateRenderer');
const { formatSharesWithWords, formatRupeesInWords } = require('../dist/main/services/utils/NumberToWords');

async function testShareCertificate13x19() {
  console.log('===========================================================');
  console.log('TESTING 13X19 INCH DUAL-PAGE SHARE CERTIFICATE GENERATOR');
  console.log('===========================================================');

  // Test 1: Number to words formatting
  assert.strictEqual(formatSharesWithWords(10), 'TEN (10)', '10 shares format');
  assert.strictEqual(formatSharesWithWords('50'), 'FIFTY (50)', '50 shares format');
  assert.strictEqual(formatRupeesInWords(500), 'FIVE HUNDRED ONLY', '500 rupees format');
  console.log('[PASS] Test 1: Number to words formatting verified.');

  const mockSociety = {
    societyName: 'SAI FLORA CO-OPERATIVE HOUSING SOCIETY LTD.',
    registrationNo: 'BOM/WT/HSG/(TC)/8847 2003-2004',
    registrationDate: '07.04.2003',
    headerAddress: 'SAI COMPLEX, NAVGHAR ROAD, MULUND (EAST), MUMBAI - 400 081.',
    address: 'SAI COMPLEX, NAVGHAR ROAD, MULUND (EAST), MUMBAI - 400 081.',
    authorisedCapital: '1,00,000/-',
    totalAuthorisedShares: '2000',
    faceValue: '50/-',
    email: 'saiflora@example.org',
    telephone: '9820098200',
    totalUnits: 20,
    unitsFlat: 20,
    unitsShop: 0,
    unitsOffice: 0,
    unitsGala: 0,
    printBlanks: 0,
  };

  const records = [
    {
      serial: '001',
      record: {
        srNo: '001',
        shareCertificateNo: '001',
        membershipNo: '001',
        noOfShares: '10',
        valueOfShares: '500',
        sharesFrom: '001',
        sharesTo: '010',
        wingNo: 'A',
        flatNo: '101',
        member1: 'MR. SANJAY BABURAO NIKALJI',
        member2: 'MRS. SUNITA SANJAY NIKALJI',
        member3: '',
        oldShareCertNo: '001',
        dateOfAllotment: '28/09/2025',
      },
    },
    {
      serial: '',
      record: null, // Blank Form
    }
  ];

  // Test 2: Generate Landscape Certificate (2 pages per entry -> 4 pages total)
  const pdfBuffer = await ShareCertificateRenderer.render(
    records,
    mockSociety,
    { templateId: 'DESIGN_A_LANDSCAPE', renderMode: 'Color' }
  );

  assert.ok(pdfBuffer && pdfBuffer.length > 5000, 'PDF buffer must be valid');
  const doc = await PDFDocument.load(pdfBuffer);
  const pageCount = doc.getPageCount();
  assert.strictEqual(pageCount, 4, 'Must have 4 pages (2 populated + 2 blank)');

  const page1 = doc.getPage(0);
  const size1 = page1.getSize();
  assert.strictEqual(size1.width, SIZE_13X19_W, 'Page width must be 1368 pt (19 in)');
  assert.strictEqual(size1.height, SIZE_13X19_H, 'Page height must be 936 pt (13 in)');
  console.log(`[PASS] Test 2: Page 1 Landscape size = ${size1.width} x ${size1.height} pt (19 x 13 inches, 0.75" safe margin).`);

  const page2 = doc.getPage(1);
  const size2 = page2.getSize();
  assert.strictEqual(size2.width, SIZE_13X19_W, 'Page 2 width must be 1368 pt');
  assert.strictEqual(size2.height, SIZE_13X19_H, 'Page 2 height must be 936 pt');
  console.log(`[PASS] Test 3: Page 2 Transfer Memorandum size = ${size2.width} x ${size2.height} pt.`);

  const outPath = path.join(__dirname, 'share_certificate_13x19_demo.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`[PASS] Test 4: PDF saved to ${outPath} (${pdfBuffer.length} bytes).`);

  console.log('===========================================================');
  console.log('ALL SHARE CERTIFICATE 13X19 TESTS PASSED! (100%)');
  console.log('===========================================================');
}

testShareCertificate13x19().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
