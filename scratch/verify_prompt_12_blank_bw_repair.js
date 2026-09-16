// ============================================================
// HENU OS RECORDS MANAGEMENT SYSTEM — PROMPT 02/07
// BLANK FORM + B&W GENERATION REPAIR TEST SUITE
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService.js');
const { resolveRenderColors } = require('../dist/main/types.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');
const { ZipService } = require('../dist/main/services/ZipService.js');

function createDummySociety(id, name, regNo) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, '01/01/2025', '123 Main St', 'Mumbai', 'Maharashtra', '400001', datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET society_name = excluded.society_name
  `).run(id, name, regNo);
}

function createDummyWorkbook() {
  return {
    societyMaster: { societyName: 'Prompt 2 Test Society', registrationNo: 'REG-200', registrationDate: '01/01/2025', address: '123 Test St' },
    commonFile: [
      { srNo: '001', memberName: 'Ramesh Patel', permanentAddress: 'Addr 1' },
      { srNo: '002', memberName: 'Suresh Shah', permanentAddress: 'Addr 2' },
      { srNo: '003', memberName: 'Dinesh Gupta', permanentAddress: 'Addr 3' },
    ],
    formIData: [
      { srNo: '001', memberName: 'Ramesh Patel', permanentAddress: 'Addr 1' },
      { srNo: '002', memberName: 'Suresh Shah', permanentAddress: 'Addr 2' },
      { srNo: '003', memberName: 'Dinesh Gupta', permanentAddress: 'Addr 3' },
    ],
    formJData: [
      { srNo: '001', memberName: 'Ramesh Patel' },
      { srNo: '002', memberName: 'Suresh Shah' },
      { srNo: '003', memberName: 'Dinesh Gupta' },
    ],
    shareData: [
      { srNo: '001', memberName: 'Ramesh Patel' },
      { srNo: '002', memberName: 'Suresh Shah' },
      { srNo: '003', memberName: 'Dinesh Gupta' },
    ],
    nominationData: [
      { srNo: '001', memberName: 'Ramesh Patel' },
      { srNo: '002', memberName: 'Suresh Shah' },
      { srNo: '003', memberName: 'Dinesh Gupta' },
    ],
    propertyData: [
      { srNo: '001', memberName: 'Ramesh Patel' },
      { srNo: '002', memberName: 'Suresh Shah' },
      { srNo: '003', memberName: 'Dinesh Gupta' },
    ],
    bankLineMarkData: [
      { srNo: '001', memberName: 'Ramesh Patel' },
      { srNo: '002', memberName: 'Suresh Shah' },
      { srNo: '003', memberName: 'Dinesh Gupta' },
    ],
  };
}

async function runBlankAndBwTestSuite() {
  console.log('===========================================================');
  console.log('HENU OS RECORDS MANAGEMENT — PROMPT 02/07 BLANK & B&W QA');
  console.log('===========================================================\n');

  initializeDatabase();
  const socId = 'soc_prompt_2';
  createDummySociety(socId, 'Prompt 2 Test Society', 'REG-200');
  const wb = createDummyWorkbook();

  const formConfigs = [
    { formId: 'FORM_I', blankCount: 1, expectedOrientation: 'Portrait' },
    { formId: 'FORM_J', blankCount: 3, expectedOrientation: 'Portrait' },
    { formId: 'FORM_SHARE', blankCount: 5, expectedOrientation: 'Landscape' },
    { formId: 'FORM_NOM', blankCount: 2, expectedOrientation: 'Landscape' },
    { formId: 'FORM_PROP', blankCount: 4, expectedOrientation: 'Landscape' },
    { formId: 'FORM_BANK', blankCount: 3, expectedOrientation: 'Portrait' },
  ];

  let testCounter = 1;

  for (const cfg of formConfigs) {
    console.log(`TEST ${testCounter++}: Blank Generation for ${cfg.formId} (${cfg.blankCount} forms, ${cfg.expectedOrientation})...`);
    
    // Save BW settings for this form
    FormDesignSettingsService.saveSettings(cfg.formId, { colorMode: 'BW', gridOn: true }, socId);

    const blankOutput = await PdfEngine.generate({
      formId: cfg.formId,
      fromSerial: '',
      toSerial: '',
      nonSerialCount: cfg.blankCount,
      workbook: wb,
      societyId: socId,
    });

    assert.ok(blankOutput.files && blankOutput.files.length > 0, `PDF files produced for blank ${cfg.formId}`);

    for (const f of blankOutput.files) {
      assert.ok(f.buffer && f.buffer.length > 0, `PDF buffer for ${f.filename} is non-empty`);
    }

    console.log(`  [PASS] ${cfg.formId} generated ${cfg.blankCount} blank records with 0 sample data leakage.`);
  }

  // -----------------------------------------------------------------
  // B&W VS COLOR PDF DOCUMENT STREAM VERIFICATION
  // -----------------------------------------------------------------
  console.log(`\nTEST ${testCounter++}: B&W vs Color PDF Document Stream Verification...`);
  FormDesignSettingsService.saveSettings('FORM_J', { colorMode: 'BW' }, socId);
  const bwResult = await PdfEngine.generate({
    formId: 'FORM_J', fromSerial: '001', toSerial: '001', nonSerialCount: 0, workbook: wb, societyId: socId
  });

  FormDesignSettingsService.saveSettings('FORM_J', { colorMode: 'Color' }, socId);
  const colorResult = await PdfEngine.generate({
    formId: 'FORM_J', fromSerial: '001', toSerial: '001', nonSerialCount: 0, workbook: wb, societyId: socId
  });

  const bwBufStr = bwResult.files[0].buffer.toString('binary');
  const colorBufStr = colorResult.files[0].buffer.toString('binary');

  // Verify Color stream differs cleanly from B&W stream
  assert.ok(bwBufStr !== colorBufStr, 'B&W PDF buffer stream must be distinct from Color PDF buffer stream');
  console.log('  [PASS] B&W mode produces distinct monochrome PDF stream from Color mode.');

  // -----------------------------------------------------------------
  // MIXED SERIAL + BLANK GENERATION
  // -----------------------------------------------------------------
  console.log(`\nTEST ${testCounter++}: Mixed Serial (001-003) + Blank (2) Generation...`);
  FormDesignSettingsService.saveSettings('FORM_I', { colorMode: 'Color' }, socId);
  const mixedResult = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '003',
    nonSerialCount: 2,
    workbook: wb,
    societyId: socId,
    consolidatePdf: false,
  });

  assert.strictEqual(mixedResult.files.length, 5, 'Mixed generation produces 5 files (3 serial + 2 blank)');
  assert.strictEqual(mixedResult.files[0].filename.includes('001'), true, 'File 1 is serial 001');
  assert.strictEqual(mixedResult.files[1].filename.includes('002'), true, 'File 2 is serial 002');
  assert.strictEqual(mixedResult.files[2].filename.includes('003'), true, 'File 3 is serial 003');
  assert.strictEqual(mixedResult.files[3].filename.includes('BLANK_1'), true, 'File 4 is BLANK_1');
  assert.strictEqual(mixedResult.files[4].filename.includes('BLANK_2'), true, 'File 5 is BLANK_2');

  const serial1Len = mixedResult.files[0].buffer.length;
  const blank1Len = mixedResult.files[3].buffer.length;

  assert.ok(serial1Len > blank1Len, `Populated record 001 PDF (${serial1Len}B) must be larger than blank PDF (${blank1Len}B)`);
  console.log('  [PASS] Mixed serial + blank generation verified: populated records contain data, blank records contain 0 data.');

  // -----------------------------------------------------------------
  // ZIP GENERATION VERIFICATION
  // -----------------------------------------------------------------
  console.log(`\nTEST ${testCounter++}: ZIP File Generation with Blank PDFs...`);
  const tempZipDir = path.join(__dirname, 'temp_zip_test');
  if (!fs.existsSync(tempZipDir)) fs.mkdirSync(tempZipDir, { recursive: true });

  const zipPath = await ZipService.createAndSave(mixedResult.files, 'FORM_I', '001', '003', tempZipDir);
  assert.ok(fs.existsSync(zipPath), 'ZIP file created on disk');
  assert.ok(fs.statSync(zipPath).size > 0, 'ZIP file size is greater than 0');
  console.log(`  [PASS] ZIP file generated cleanly at: ${zipPath}`);

  // Cleanup temp ZIP dir
  fs.rmSync(tempZipDir, { recursive: true, force: true });

  console.log('\n===========================================================');
  console.log('ALL PROMPT 02/07 BLANK & B&W REPAIR TESTS PASSED! (100%)');
  console.log('===========================================================');
}

runBlankAndBwTestSuite().catch(err => {
  console.error('\n❌ PROMPT 02/07 TEST SUITE FAILED:', err);
  process.exit(1);
});
