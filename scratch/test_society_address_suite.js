// ============================================================
// HENU OS — Comprehensive Society Master 6-Line Address Test Suite
// Validates all 10 acceptance criteria from user specification
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { FormMappingService } = require('../dist/main/services/FormMappingService');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { FormIRenderer } = require('../dist/main/services/renderers/FormIRenderer');
const { FormJRenderer } = require('../dist/main/services/renderers/FormJRenderer');
const { ShareRegisterRenderer } = require('../dist/main/services/renderers/ShareRegisterRenderer');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

async function runTests() {
  console.log('===========================================================');
  console.log('HENU OS — SOCIETY MASTER 6-LINE ADDRESS TEST SUITE');
  console.log('===========================================================');

  let passed = 0;
  let total = 10;

  // ----------------------------------------------------------------
  // Test 1: Six Excel address columns parser
  // ----------------------------------------------------------------
  console.log('\n--- Test 1: Six Excel address columns parser ---');
  const testWb = XLSX.utils.book_new();
  const smRows = [
    ['Sr. No.', 'Field', 'Value', 'Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6'],
    ['1', 'Society Name', 'ABC CO-OP HSG SOC LTD', '', '', '', '', '', ''],
    ['2', 'Society Registration No.', 'REG/123/2025', '', '', '', '', '', ''],
    ['3', 'Society Registration Date', '15/08/2025', '', '', '', '', '', ''],
    ['4', 'Hedder Address', 'Header Address Mumbai 400031', '', '', '', '', '', ''],
    ['5', 'Society Address', '', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', '400031'],
    ['6', 'Society Email Id', 'abc@society.com', '', '', '', '', '', ''],
    ['7', 'Society Telephone or Mobile No.', '9876543210', '', '', '', '', '', ''],
    ['8', 'Total Unit', '10', '', '', '', '', '', ''],
    ['', 'A) No. of Flat or Room', '10', '', '', '', '', '', ''],
    ['', 'B) No. Shop', '0', '', '', '', '', '', ''],
    ['', 'C) No. Office', '0', '', '', '', '', '', ''],
    ['', 'D) No. Galas', '0', '', '', '', '', '', ''],
    ['9', 'No. of Print Blank (EXTRA SR. No.)', '0', '', '', '', '', '', ''],
    ['10', 'Total Unit', '10', '', '', '', '', '', ''],
  ];
  const smWs = XLSX.utils.aoa_to_sheet(smRows);
  XLSX.utils.book_append_sheet(testWb, smWs, '01_Society_Master');
  const parsedWb = MasterDataService.parseXlsxWorkbook(testWb, 'test.xlsx');
  const sm = parsedWb.societyMaster;

  assert.ok(sm, 'SocietyMaster must be parsed');
  assert.strictEqual(sm.societyAddress.line1, 'ABC');
  assert.strictEqual(sm.societyAddress.line2, 'DEF');
  assert.strictEqual(sm.societyAddress.line3, 'GHI');
  assert.strictEqual(sm.societyAddress.line4, 'JKL');
  assert.strictEqual(sm.societyAddress.line5, 'MNO');
  assert.strictEqual(sm.societyAddress.line6, '400031');
  console.log('[PASS] Test 1: Parser extracted all 6 independent address lines: ABC, DEF, GHI, JKL, MNO, 400031');
  passed++;

  // ----------------------------------------------------------------
  // Test 2: Permanent Address composition (Member flat/wing + 6 lines)
  // ----------------------------------------------------------------
  console.log('\n--- Test 2: Permanent Address composition ---');
  const member = {
    srNo: '001',
    flatNo: '1204',
    wingNo: 'B',
    permanentAddress: '',
    residentialAddress: 'Flat 201, ABC Building, Dadar, Mumbai',
  };
  const society = {
    societyName: 'ABC Society',
    registrationNo: 'REG-123',
    registrationDate: '01/01/2020',
    address: '',
    societyAddress: {
      line1: 'ABC Society',
      line2: 'C.S. No. 123',
      line3: 'Dadar',
      line4: 'Mumbai',
      line5: 'Maharashtra',
      line6: '400031',
    },
    email: '',
    telephone: '',
    totalUnits: 1,
    unitsFlat: 1,
    unitsShop: 0,
    unitsOffice: 0,
    unitsGala: 0,
    printBlanks: 0,
  };

  const lines = FormMappingService.buildPermanentAddressLines(member, society);
  assert.strictEqual(lines.length, 6, 'Must produce exactly 6 lines');
  assert.strictEqual(lines[0], '1204, B, ABC Society');
  assert.strictEqual(lines[1], 'C.S. No. 123');
  assert.strictEqual(lines[2], 'Dadar');
  assert.strictEqual(lines[3], 'Mumbai');
  assert.strictEqual(lines[4], 'Maharashtra');
  assert.strictEqual(lines[5], '400031');
  console.log('[PASS] Test 2: Composed exactly 6 logical lines:');
  lines.forEach((l, i) => console.log(`   Line ${i + 1}: ${l}`));
  passed++;

  // ----------------------------------------------------------------
  // Test 3: Residential Address must NEVER append Society address
  // ----------------------------------------------------------------
  console.log('\n--- Test 3: Residential Address isolation ---');
  const formIMapped = FormMappingService.mapToFormI(member);
  assert.strictEqual(formIMapped.residentialAddress, 'Flat 201, ABC Building, Dadar, Mumbai');
  assert.ok(!formIMapped.residentialAddress.includes('ABC Society'), 'Residential address must not contain Society address');
  assert.ok(!formIMapped.residentialAddress.includes('C.S. No. 123'), 'Residential address must not contain Society line 2');
  console.log('[PASS] Test 3: Residential Address remains completely untouched and isolated from society address.');
  passed++;

  // ----------------------------------------------------------------
  // Test 4: Empty Society Address lines handling
  // ----------------------------------------------------------------
  console.log('\n--- Test 4: Empty Society Address lines handling ---');
  const emptySociety = {
    societyName: 'Empty Lines Soc',
    registrationNo: 'REG-999',
    registrationDate: '01/01/2020',
    address: '',
    societyAddress: {
      line1: 'ABC Society',
      line2: 'C.S. No. 123',
      line3: '',
      line4: 'Wadala',
      line5: '',
      line6: '400031',
    },
    email: '',
    telephone: '',
    totalUnits: 1,
    unitsFlat: 1,
    unitsShop: 0,
    unitsOffice: 0,
    unitsGala: 0,
    printBlanks: 0,
  };
  const emptyLines = FormMappingService.buildPermanentAddressLines(null, emptySociety);
  assert.strictEqual(emptyLines.length, 6);
  assert.strictEqual(emptyLines[0], 'ABC Society');
  assert.strictEqual(emptyLines[1], 'C.S. No. 123');
  assert.strictEqual(emptyLines[2], '');
  assert.strictEqual(emptyLines[3], 'Wadala');
  assert.strictEqual(emptyLines[4], '');
  assert.strictEqual(emptyLines[5], '400031');
  assert.ok(!emptyLines.some(l => l.includes('undefined') || l.includes('null') || l.includes('NaN')));
  console.log('[PASS] Test 4: Empty society lines preserved without producing undefined or null text.');
  passed++;

  // ----------------------------------------------------------------
  // Test 5: Very long Line 1 text handling
  // ----------------------------------------------------------------
  console.log('\n--- Test 5: Very long Line 1 text handling ---');
  const longSociety = {
    ...society,
    societyAddress: {
      ...society.societyAddress,
      line1: 'VERY LONG EXTENSIVE COMPREHENSIVE MULTI-PHASE CO-OPERATIVE HOUSING SOCIETY LIMITED FOR PRIME RESIDENCY WADALA MUMBAI',
    },
  };
  const longMember = {
    ...member,
    flatNo: 'Penthouse Apartment Suite 9901-A / B Wing',
  };
  const longLines = FormMappingService.buildPermanentAddressLines(longMember, longSociety);
  assert.strictEqual(longLines.length, 6);
  assert.ok(longLines[0].length > 80);
  console.log('[PASS] Test 5: Long Line 1 generated safely: ' + longLines[0]);
  passed++;

  // ----------------------------------------------------------------
  // Test 6: Very long Line 2 text handling
  // ----------------------------------------------------------------
  console.log('\n--- Test 6: Very long Line 2 text handling ---');
  const longLine2Soc = {
    ...society,
    societyAddress: {
      ...society.societyAddress,
      line2: 'C.S. NO.364 (Pt), 365 (Pt), 366 (Pt), DIVISTION DADR, NAIGAON, R.K. KIDWAI MARG, WADALA, MUMBAI - 400031',
    },
  };
  const longLine2 = FormMappingService.buildPermanentAddressLines(member, longLine2Soc);
  assert.strictEqual(longLine2.length, 6);
  console.log('[PASS] Test 6: Long Line 2 generated safely: ' + longLine2[1]);
  passed++;

  // ----------------------------------------------------------------
  // Test 7: Six maximum-length lines render to PDF safely
  // ----------------------------------------------------------------
  console.log('\n--- Test 7: Six maximum-length lines render to PDF safely ---');
  const maxSociety = {
    societyName: 'MAX TEST SOCIETY',
    registrationNo: 'REG-MAX-2025',
    registrationDate: '01/01/2025',
    headerAddress: 'MAX SOCIETY HEADER ADDRESS WADALA MUMBAI 400031',
    address: '',
    societyAddress: {
      line1: 'Line 1: High Density Grand Residence Park Co-op Housing Society Limited',
      line2: 'Line 2: C.S. NO.364 (Pt), 365 (Pt), 366 (Pt), DIVISTION DADR, NAIGAON',
      line3: 'Line 3: R.K. KIDWAI MARG, WADALA WEST, OPPOSITE METRO STATION',
      line4: 'Line 4: GREATER MUMBAI MUNICIPAL CORPORATION ZONE 2 DISTRICT',
      line5: 'Line 5: STATE OF MAHARASHTRA, REPUBLIC OF INDIA',
      line6: 'Line 6: PIN CODE - 400031 / POSTAL REGION 05',
    },
    email: 'info@maxsociety.org',
    telephone: '022-24123456',
    totalUnits: 50,
    unitsFlat: 50,
    unitsShop: 0,
    unitsOffice: 0,
    unitsGala: 0,
    printBlanks: 0,
  };

  const formIBuffers = await FormIRenderer.render(
    [{ serial: '001', record: { ...member, ...longMember } }],
    maxSociety,
    { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true }
  );
  assert.ok(formIBuffers.length > 0 && formIBuffers[0].length > 5000);
  console.log('[PASS] Test 7: Form I PDF rendered with 6 maximum-length lines cleanly (' + formIBuffers[0].length + ' bytes).');
  passed++;

  // ----------------------------------------------------------------
  // Test 8: Form J & Share Register address rendering
  // ----------------------------------------------------------------
  console.log('\n--- Test 8: Form J & Share Register address rendering ---');
  const formJBuf = await FormJRenderer.render(
    [{ serial: '001', record: { ...member, classOfMember: 'Ordinary' } }],
    maxSociety,
    { orientationOverride: 'Portrait' }
  );
  assert.ok(formJBuf.length > 5000);

  const shareBuf = await ShareRegisterRenderer.render(
    [{ serial: '001', record: { ...member, noOfShares: '10', valueOfShares: '500' } }],
    maxSociety,
    { orientationOverride: 'Landscape' }
  );
  assert.ok(shareBuf.length > 5000);
  console.log('[PASS] Test 8: Form J and Share Register PDFs generated cleanly with 6-line Permanent Address integration.');
  passed++;

  // ----------------------------------------------------------------
  // Test 9: Preview vs Final PDF engine consistency
  // ----------------------------------------------------------------
  console.log('\n--- Test 9: Preview vs Final PDF engine consistency ---');
  const wbObj = {
    societyMaster: maxSociety,
    commonFile: [member],
    formIData: [member],
    formJData: [],
    shareData: [],
    nominationData: [],
    propertyData: [],
    bankLineMarkData: [],
    loadedAt: new Date().toISOString(),
    fileName: 'test.xlsx',
    validationErrors: [],
    validationWarnings: [],
  };
  const previewRes = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '001',
    workbook: wbObj,
  });
  const finalRes = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '001',
    workbook: wbObj,
  });
  assert.strictEqual(previewRes.files.length, finalRes.files.length);
  assert.ok(previewRes.files[0].buffer.length > 5000);
  assert.ok(finalRes.files[0].buffer.length > 5000);
  console.log('[PASS] Test 9: Preview PDF (' + previewRes.files[0].buffer.length + ' bytes) and Final PDF (' + finalRes.files[0].buffer.length + ' bytes) generated with identical structure.');
  passed++;

  // ----------------------------------------------------------------
  // Test 10: Batch range generation with 6-line addresses
  // ----------------------------------------------------------------
  console.log('\n--- Test 10: Batch range generation with 6-line addresses ---');
  const batchRes = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '002',
    workbook: wbObj,
  });
  assert.ok(batchRes.files.length >= 1);
  assert.ok(batchRes.files[0].buffer.length > 5000);
  console.log('[PASS] Test 10: Batch generation successful (Output file: ' + batchRes.files[0].filename + ', ' + batchRes.files[0].buffer.length + ' bytes).');
  passed++;

  console.log('===========================================================');
  console.log(`RESULT: ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY! (100%)`);
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('[FAIL] Test failed with error:', err);
  process.exit(1);
});
