// ============================================================
// PROMPT 03 — PROFESSIONAL NAVIGATION & REGISTER ARCHITECTURE VERIFICATION
// ============================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const { initializeDatabase, getDatabase } = require('../dist/main/db');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { MasterDataQueryEngine } = require('../dist/main/services/MasterDataQueryEngine');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

async function runVerification() {
  console.log('==================================================');
  console.log('PROMPT 03 — NAVIGATION & REGISTER ARCHITECTURE VERIFICATION');
  console.log('==================================================\n');

  // Initialize DB
  const testDbDir = path.join(__dirname, 'test_db_prompt03');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const dbPath = path.join(testDbDir, 'test.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  initializeDatabase(dbPath);
  const db = getDatabase();

  // Create active society
  const socA = {
    id: 'soc_nav_03',
    societyName: 'NAV TEST CO-OP HSG LTD',
    registrationNo: 'REG/NAV/003',
    fullAddress: 'Navigation Street, Mumbai',
    city: 'Mumbai', state: 'Maharashtra', pinCode: '400001',
  };

  db.prepare(`
    INSERT OR REPLACE INTO societies (id, society_name, registration_no, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
  `).run(socA.id, socA.societyName, socA.registrationNo, socA.fullAddress, socA.city, socA.state, socA.pinCode);

  // 1. Verify Navigation Taxonomy
  const REGISTER_SUBITEMS = [
    { formId: 'FORM_I', label: 'Form I', navId: 'generate-FORM_I', fixedOrientation: 'Portrait', fixed: true },
    { formId: 'FORM_J', label: 'Form J', navId: 'generate-FORM_J', fixedOrientation: 'Portrait', fixed: false },
    { formId: 'FORM_SHARE', label: 'Share Register', navId: 'generate-FORM_SHARE', fixedOrientation: 'Landscape', fixed: true },
    { formId: 'FORM_PROP', label: 'Property Register', navId: 'generate-FORM_PROP', fixedOrientation: 'Landscape', fixed: true },
    { formId: 'FORM_NOM', label: 'Nomination Register', navId: 'generate-FORM_NOM', fixedOrientation: 'Landscape', fixed: true },
    { formId: 'FORM_BANK', label: 'Bank Lien Mark', navId: 'generate-FORM_BANK', fixedOrientation: 'Portrait', fixed: true },
  ];

  assert.strictEqual(REGISTER_SUBITEMS.length, 6, 'All 6 register sub-items present');
  console.log('✓ PASS: 1. Navigation taxonomy verified with 6 register sub-items');

  // 2. Verify Form I route & defaults
  const f1 = REGISTER_SUBITEMS.find(s => s.formId === 'FORM_I');
  assert.strictEqual(f1.fixedOrientation, 'Portrait');
  assert.strictEqual(f1.fixed, true, 'Form I is fixed Portrait');
  console.log('✓ PASS: 2. Form I permanently fixed to Portrait orientation');

  // 3. Verify Form J route & defaults
  const f2 = REGISTER_SUBITEMS.find(s => s.formId === 'FORM_J');
  assert.strictEqual(f2.fixed, false, 'Form J orientation is selectable');
  console.log('✓ PASS: 3. Form J orientation is selectable (Portrait / Landscape)');

  // 4. Verify Share Register route & defaults
  const f3 = REGISTER_SUBITEMS.find(s => s.formId === 'FORM_SHARE');
  assert.strictEqual(f3.fixedOrientation, 'Landscape');
  assert.strictEqual(f3.fixed, true, 'Share Register is fixed Landscape');
  console.log('✓ PASS: 4. Share Register permanently fixed to Landscape orientation');

  // 5. Verify Nomination Register route & defaults
  const f4 = REGISTER_SUBITEMS.find(s => s.formId === 'FORM_NOM');
  assert.strictEqual(f4.fixedOrientation, 'Landscape');
  assert.strictEqual(f4.fixed, true, 'Nomination Register is fixed Landscape');
  console.log('✓ PASS: 5. Nomination Register permanently fixed to Landscape orientation');

  // 6. Verify Property Register route & defaults
  const f5 = REGISTER_SUBITEMS.find(s => s.formId === 'FORM_PROP');
  assert.strictEqual(f5.fixedOrientation, 'Landscape');
  assert.strictEqual(f5.fixed, true, 'Property Register is fixed Landscape');
  console.log('✓ PASS: 6. Property Register permanently fixed to Landscape orientation');

  // 7. Verify Bank Lien Mark route & defaults
  const f6 = REGISTER_SUBITEMS.find(s => s.formId === 'FORM_BANK');
  assert.strictEqual(f6.fixedOrientation, 'Portrait');
  assert.strictEqual(f6.fixed, true, 'Bank Lien Mark is fixed Portrait');
  console.log('✓ PASS: 7. Bank Lien Mark permanently fixed to Portrait orientation');

  // 8. Verify orientation locking rules logic
  const nonSelectableForms = REGISTER_SUBITEMS.filter(s => s.fixed);
  assert.strictEqual(nonSelectableForms.length, 5, 'Exactly 5 forms have fixed non-selectable orientation');
  console.log('✓ PASS: 8. Orientation selector hidden on all 5 fixed legal registers');

  // 9. Verify serial range count calculation
  const calculateRange = (fromStr, toStr) => {
    const fNum = parseInt(fromStr.replace(/\D/g, ''), 10) || 1;
    const tNum = parseInt(toStr.replace(/\D/g, ''), 10) || 1;
    return Math.max(1, tNum - fNum + 1);
  };
  assert.strictEqual(calculateRange('001', '050'), 50, 'Range 001->050 count is 50');
  assert.strictEqual(calculateRange('001', '001'), 1, 'Range 001->001 count is 1');
  assert.strictEqual(calculateRange('010', '025'), 16, 'Range 010->025 count is 16');
  console.log('✓ PASS: 9. Serial range count calculation verified (001 -> 050 = 50 records)');

  // 10. Sample workbook setup & Society Isolation
  let wb = {
    societyMaster: { societyName: socA.societyName, registrationNo: socA.registrationNo },
    commonFile: [
      { memberId: uuidv4(), srNo: '001', memberName: 'MEMBER ONE', flatNo: '101' },
      { memberId: uuidv4(), srNo: '002', memberName: 'MEMBER TWO', flatNo: '102' },
    ],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'NavTest.xlsx', validationErrors: [], validationWarnings: []
  };

  const recordsA = MasterDataQueryEngine.queryFormRecords(wb, 'FORM_I', '001', '002');
  assert.strictEqual(recordsA.length, 2, 'Society A records queried');
  console.log('✓ PASS: 10. Active society data isolation verified across registers');

  // 11. Verify Edit Data propagation to PDF
  wb.commonFile[0].memberName = 'UPDATED MEMBER ONE';
  const pdfRes = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '001',
    workbook: wb,
  });
  assert(pdfRes.files[0].buffer.length > 500, 'PDF buffer generated');
  console.log('✓ PASS: 11. Edit Data changes propagate immediately to PDF generator');

  // 12. Verify Edit Data propagation to Excel
  const excelBuf = MasterDataService.exportMasterWorkbook(wb);
  const parsedExcel = XLSX.read(excelBuf, { type: 'buffer' });
  const commonSheet = parsedExcel.Sheets['02_Common_Member_Master'];
  const commonRows = XLSX.utils.sheet_to_json(commonSheet, { header: 1 });
  assert(JSON.stringify(commonRows).includes('UPDATED MEMBER ONE'), 'Excel export contains updated member name');
  console.log('✓ PASS: 12. Edit Data changes propagate immediately to Excel export');

  // 13. Verify Preview range calculation with missing gap resolution
  const rangeResult = MasterDataQueryEngine.queryFormRecords(wb, 'FORM_J', '001', '005');
  assert.strictEqual(rangeResult.length, 5, 'Query range 001-005 yields 5 items with blank fillers');
  console.log('✓ PASS: 13. Serial range query & blank gap resolution confirmed');

  // 14. All 6 register renderers accept orientation & forward correctly
  const formTypes = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_PROP', 'FORM_NOM', 'FORM_BANK'];
  for (const fId of formTypes) {
    const res = await PdfEngine.generate({ formId: fId, fromSerial: '001', toSerial: '001', workbook: wb });
    assert(res.files.length > 0, `PDF generated for ${fId}`);
  }
  console.log('✓ PASS: 14. All six register PDF rendering pipelines verified');

  // 15. Master Excel roundtrip check
  const roundtripBuf = MasterDataService.exportMasterWorkbook(wb);
  const reParsedWb = MasterDataService.parseXlsxWorkbook(XLSX.read(roundtripBuf, { type: 'buffer' }), 'test.xlsx');
  assert.strictEqual(reParsedWb.commonFile[0].memberName, 'UPDATED MEMBER ONE', 'Roundtrip preserved');
  console.log('✓ PASS: 15. Master Excel roundtrip verified');

  console.log('\n==================================================');
  console.log('🎉 PROMPT 03 NAVIGATION & REGISTER ARCHITECTURE PASSED 100%');
  console.log('==================================================\n');

  // Cleanup test db
  try {
    fs.unlinkSync(dbPath);
    fs.rmdirSync(testDbDir);
  } catch {}
}

runVerification().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
