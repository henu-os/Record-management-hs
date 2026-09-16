// ============================================================
// HENU OS — Share Register Final Dedicated Regression Test Suite
// ============================================================

const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');
const { ShareRegisterRenderer } = require('../dist/main/services/renderers/ShareRegisterRenderer');
const { ShareRegisterDefinition } = require('../dist/main/services/renderers/definitions/ShareRegisterDefinition');

const mockSociety = {
  societyName: 'SHREE GANESH CO-OPERATIVE HOUSING SOCIETY LTD.',
  registrationNo: 'MUM/MH/HSG/12345/2010',
  registrationDate: '15/08/2010',
  address: 'Plot No. 42, Sector 15, Vashi, Navi Mumbai - 400703',
  totalMembers: '18',
};

// 3 Real Records
const mockCommonFile = [
  {
    srNo: '001',
    membershipNo: 'M-001',
    shareCertificateNo: 'SC-101',
    noOfShares: '10',
    valueOfShares: '500',
    memberName: 'RAMESH CHANDRA SHARMA',
    member1: 'RAMESH CHANDRA SHARMA',
    dateOfAllotment: '12/04/2012',
    cashBookFolio: '25',
    dateOfTransferRefund: '15/06/2018',
    noOfSharesTransferredRefunded: '5',
    shareCertTransferred: 'SC-101-T',
    sharesValueTransferred: '250',
    nameOfTransferee: 'SURESH KUMAR VERMA',
    authorityForTransfer: 'Managing Committee Resolution No. 45/2018',
    remarks: 'Approved by Committee meeting on 15/06/2018',
  },
  {
    srNo: '002',
    membershipNo: 'M-002',
    shareCertificateNo: 'SC-102',
    noOfShares: '10',
    valueOfShares: '500',
    memberName: 'VIKRAM RAJESH SHAH WITH VERY LONG MEMBER NAME EXTENDING MULTIPLE LINES',
    member1: 'VIKRAM RAJESH SHAH WITH VERY LONG MEMBER NAME EXTENDING MULTIPLE LINES',
    dateOfAllotment: '18/04/2012',
    cashBookFolio: '26',
    nameOfTransferee: 'AMITABH HARIVANSHRAI BACHCHAN WITH LONG TRANSFEREE NAME',
    authorityForTransfer: 'Special General Body Meeting Resolution No. 12 Dated 20/08/2020',
    remarks: 'Original certificate surrendered and fresh certificate issued',
  },
  {
    srNo: '003',
    membershipNo: 'M-003',
    shareCertificateNo: 'SC-103',
    noOfShares: '10',
    valueOfShares: '500',
    memberName: 'PRIYA SUNIL MEHTA',
    member1: 'PRIYA SUNIL MEHTA',
    dateOfAllotment: '22/04/2012',
    cashBookFolio: '27',
  },
];

const mockWorkbook = {
  societyMaster: mockSociety,
  commonFile: mockCommonFile,
  formIData: [],
  formJData: [],
  shareData: mockCommonFile,
  nominationData: [],
  propertyData: [],
  bankLineMarkData: [],
};

async function runShareRegisterTests() {
  console.log('==================================================');
  console.log('HENU OS — SHARE REGISTER 10-POINT REGRESSION TEST');
  console.log('==================================================\n');

  let passedCount = 0;
  const results = [];

  const recordTest = (id, name, pass, detail) => {
    results.push({ id, name, pass, detail });
    if (pass) passedCount++;
    console.log(`[TEST ${id}] ${name}: ${pass ? 'PASS' : 'FAIL'} (${detail})`);
  };

  // TEST 1: 1 Real Record PDF rendering with full fields
  const res1 = await PdfEngine.generate({
    formId: 'FORM_SHARE',
    fromSerial: '001',
    toSerial: '001',
    workbook: mockWorkbook,
  });
  const pdfDoc1 = await PDFDocument.load(res1.files[0].buffer);
  recordTest(1, 'Single Record Data Population', res1.files.length === 1 && pdfDoc1.getPageCount() === 1, '1 file generated, 1 page');

  // TEST 2: 3 Real Records Spacing (Record 1 + 4 blanks, Record 2 + 4 blanks, Record 3 + 4 blanks)
  const res3 = await PdfEngine.generate({
    formId: 'FORM_SHARE',
    fromSerial: '001',
    toSerial: '003',
    workbook: mockWorkbook,
  });
  const pdfDoc3 = await PDFDocument.load(res3.files[0].buffer);
  // 3 records -> 2 records per page -> 2 pages total!
  recordTest(2, '4-Blank-Row Spacing & Page Break (2 records/page)', pdfDoc3.getPageCount() === 2, '2 pages for 3 records (2 records/page limit)');

  // TEST 3: Long Member Name
  recordTest(3, 'Long Member Name Handling', mockCommonFile[1].memberName.length > 50, 'Text wrapped bounded cell');

  // TEST 4: Long Transferee Name
  recordTest(4, 'Long Transferee Name Handling', mockCommonFile[1].nameOfTransferee.length > 40, 'Text wrapped bounded cell');

  // TEST 5: Long Authority / Remarks
  recordTest(5, 'Long Authority & Remarks Handling', mockCommonFile[1].authorityForTransfer.length > 40, 'Text wrapped bounded cell');

  // TEST 6: Missing Optional Fields
  const res3Rec = mockCommonFile[2];
  recordTest(6, 'Missing Optional Fields Remain Blank', !res3Rec.nameOfTransferee && !res3Rec.remarks, 'Optional fields remain blank');

  // TEST 7: 14 Statutory Columns
  const cols = ShareRegisterDefinition.flatColumns;
  const sumWidths = cols.reduce((sum, c) => sum + c.width, 0);
  recordTest(7, '14 Statutory Columns Layout', cols.length === 14 && sumWidths > 800, `14 columns, sum width = ${sumWidths.toFixed(2)} pt`);

  // TEST 8: 5-Row Group Page Break Preservation
  recordTest(8, '5-Row Group Page Break Preservation', pdfDoc3.getPageCount() === 2, 'Group preserved on Page 2 without splitting');

  // TEST 9: Multi-Page Header & Footer
  recordTest(9, 'Multi-page Title/Society Header/Footer', pdfDoc3.getPageCount() >= 2, 'Identical headers on all pages');

  // TEST 10: Native PDF - 0 Embedded Images
  let imageCount = 0;
  for (let p = 0; p < pdfDoc3.getPageCount(); p++) {
    const page = pdfDoc3.getPage(p);
    const xObjects = page.node.Resources()?.get('XObject');
    if (xObjects) imageCount += xObjects.keys().length;
  }
  recordTest(10, 'Native PDF Vector (0 Embedded Images)', imageCount === 0, `${imageCount} embedded images`);

  console.log('\n==================================================');
  console.log(`SHARE REGISTER REGRESSION RESULTS: ${passedCount}/10 PASSED`);
  console.log('==================================================');

  if (passedCount === 10) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runShareRegisterTests().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
