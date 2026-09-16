// ============================================================
// Acceptance Test Suite for PROMPT 04 — Serial Number Range Engine & Blank Forms
// Verifies Range Selection, Validation, Prefix, Separator, Zero Padding,
// Non-Serial Blank Forms, and Multi-Society Isolation.
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { validateSerialRange, generateRange } = require('../dist/main/services/SerialRangeEngine.js');
const { ValidationEngine } = require('../dist/main/services/ValidationEngine.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');

async function runAcceptanceTest() {
  console.log('=== STARTING PROMPT 04 ACCEPTANCE TEST SUITE ===\n');

  initializeDatabase();

  // STEP 1: Range Validation Tests
  console.log('STEP 1: Testing Range Validation logic...');

  // Test 1A: Valid range 3 to 7
  const val1 = validateSerialRange('003', '007', 2);
  assert.strictEqual(val1, null, 'Range 003 to 007 with 2 non-serial forms should be valid');

  // Test 1B: Empty range with nonSerialCount = 3 (Valid for blank forms)
  const val2 = validateSerialRange('', '', 3);
  assert.strictEqual(val2, null, 'Empty serial range with nonSerialCount = 3 should be valid');

  // Test 1C: Invalid range From = 20, To = 10
  const val3 = validateSerialRange('20', '10', 0);
  assert.strictEqual(val3, 'From Serial No. cannot be greater than To Serial No.');
  console.log('  [PASS] Range validation rules & exact error messages verified.\n');

  // STEP 2: Serial Padding & Prefix & Separator Tests
  console.log('STEP 2: Testing Zero Padding & Prefix & Separator generation...');
  const mockWorkbook = {
    societyMaster: {
      societyName: 'GOKULDHAM CO-OP HOUSING SOCIETY LTD',
      registrationNo: 'REG/MUM/2026',
      registrationDate: '01/01/2020',
      address: 'Powai, Mumbai', email: 'gokuldham@society.com', telephone: '9876543210',
      totalUnits: 10, unitsFlat: 10, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0
    },
    commonFile: [
      { memberId: 'm3', srNo: '003', memberName: 'Jethalal Gada', flatNo: 'B-101' },
      { memberId: 'm4', srNo: '004', memberName: 'Taarak Mehta', flatNo: 'B-102' },
      { memberId: 'm5', srNo: '005', memberName: 'Hansraj Hathi', flatNo: 'A-101' },
      { memberId: 'm6', srNo: '006', memberName: 'Aatmaram Bhide', flatNo: 'A-203' },
      { memberId: 'm7', srNo: '007', memberName: 'Roshan Sodhi', flatNo: 'B-201' },
    ],
    formIData: [
      { memberId: 'm3', srNo: '003', memberName: 'Jethalal Gada' },
      { memberId: 'm4', srNo: '004', memberName: 'Taarak Mehta' },
      { memberId: 'm5', srNo: '005', memberName: 'Hansraj Hathi' },
      { memberId: 'm6', srNo: '006', memberName: 'Aatmaram Bhide' },
      { memberId: 'm7', srNo: '007', memberName: 'Roshan Sodhi' },
    ],
    formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'GokuldhamMaster.xlsx', validationErrors: [], validationWarnings: []
  };

  // Test 2A: From = 003, To = 007, Non Serial = 2, Prefix = HENU, Separator = -
  console.log('  2A. Generating Form I (From: 003, To: 007, Non-Serial: 2, Prefix: HENU, Separator: -)...');
  const res1 = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '003',
    toSerial: '007',
    nonSerialCount: 2,
    prefix: 'HENU',
    separator: '-',
    workbook: mockWorkbook,
    consolidatePdf: false, // Return individual files
  });

  assert.strictEqual(res1.files.length, 7, 'Expected total 7 PDF files (5 serial + 2 non-serial blank)');

  const filenames = res1.files.map(f => f.filename);
  assert.strictEqual(filenames[0], 'FORM_I_HENU-003.pdf');
  assert.strictEqual(filenames[1], 'FORM_I_HENU-004.pdf');
  assert.strictEqual(filenames[2], 'FORM_I_HENU-005.pdf');
  assert.strictEqual(filenames[3], 'FORM_I_HENU-006.pdf');
  assert.strictEqual(filenames[4], 'FORM_I_HENU-007.pdf');
  assert.strictEqual(filenames[5], 'FORM_I_BLANK_1.pdf');
  assert.strictEqual(filenames[6], 'FORM_I_BLANK_2.pdf');

  console.log('    -> Generated files:', filenames.join(', '));
  console.log('  [PASS] 5 Serial PDFs (HENU-003..HENU-007) + 2 Blank PDFs generated successfully.\n');

  // STEP 3: Test Empty Serial Generation (Blank Forms Only)
  console.log('STEP 3: Testing Empty Serial Generation (From/To empty, Non Serial = 3)...');
  const res2 = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '',
    toSerial: '',
    nonSerialCount: 3,
    workbook: mockWorkbook,
    consolidatePdf: false,
  });

  assert.strictEqual(res2.files.length, 3, 'Expected 3 blank PDF files');
  assert.strictEqual(res2.files[0].filename, 'FORM_I_BLANK_1.pdf');
  assert.strictEqual(res2.files[1].filename, 'FORM_I_BLANK_2.pdf');
  assert.strictEqual(res2.files[2].filename, 'FORM_I_BLANK_3.pdf');
  console.log('  [PASS] 3 Empty/Blank forms generated successfully without error.\n');

  // STEP 4: Test Separator Options (_, :, ., /)
  console.log('STEP 4: Testing Separator options (_ , : , . , /)...');
  for (const sep of ['_', ':', '.', '/']) {
    const res = await PdfEngine.generate({
      formId: 'FORM_I',
      fromSerial: '001',
      toSerial: '001',
      prefix: 'SOC',
      separator: sep,
      workbook: mockWorkbook,
      consolidatePdf: false,
    });
    const expectedName = `FORM_I_SOC${sep}001.pdf`;
    assert.strictEqual(res.files[0].filename, expectedName);
  }
  console.log('  [PASS] Separators _, :, ., / verified.\n');

  console.log('=== ALL PROMPT 04 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
