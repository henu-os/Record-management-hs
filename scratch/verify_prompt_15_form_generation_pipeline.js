// ============================================================
// HENU OS RECORDS MANAGEMENT SYSTEM — PROMPT 05/07
// FORM GENERATION + EXPORT PIPELINE QA TEST SUITE
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');
const { ZipService } = require('../dist/main/services/ZipService.js');
const { MasterDataService } = require('../dist/main/services/MasterDataService.js');

function createSocietyInDb(id, name, regNo) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, '01/01/2025', '123 Main St', 'Mumbai', 'Maharashtra', '400001', datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET society_name = excluded.society_name
  `).run(id, name, regNo);
}

function createDummyMasterWorkbook() {
  const sampleMembers = [
    { srNo: '001', memberId: 'm1', memberName: 'Ramesh Patel', membershipNo: 'M001', flatNo: '101', wingNo: 'A' },
    { srNo: '002', memberId: 'm2', memberName: 'Suresh Shah', membershipNo: 'M002', flatNo: '102', wingNo: 'A' },
    { srNo: '003', memberId: 'm3', memberName: 'Dinesh Gupta', membershipNo: 'M003', flatNo: '103', wingNo: 'A' },
  ];

  return {
    societyMaster: { societyName: 'Pipeline Test Society Ltd.', registrationNo: 'REG-PIPE-100' },
    commonFile: sampleMembers,
    formIData: sampleMembers.map(m => ({ ...m, dateOfAdmission: '01/01/2020', occupation: 'Service' })),
    formJData: sampleMembers.map(m => ({ ...m, classOfMember: 'Active' })),
    shareData: sampleMembers.map(m => ({ ...m, noOfShares: '10', valueOfShares: '500' })),
    nominationData: sampleMembers.map(m => ({ ...m, nomineeName: 'Anita Patel', dateOfNomination: '01/01/2021' })),
    propertyData: sampleMembers.map(m => ({ ...m, descriptionOfTenement: 'Residential Flat 101', area: '850 sq.ft.' })),
    bankLineMarkData: sampleMembers.map(m => ({ ...m, bankName: 'State Bank of India', loanAmount: '5000000' })),
  };
}

async function runFormGenerationPipelineTestSuite() {
  console.log('===========================================================');
  console.log('HENU OS RECORDS MANAGEMENT — PROMPT 05/07 GENERATION QA');
  console.log('===========================================================\n');

  initializeDatabase();
  const socId = 'soc_pipe_A';
  createSocietyInDb(socId, 'Pipeline Test Society Ltd.', 'REG-PIPE-100');
  const masterWb = createDummyMasterWorkbook();

  const tempDir = path.join(__dirname, 'temp_pipeline_test');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const formsToTest = [
    { id: 'FORM_I', name: 'Form I — Register of Members' },
    { id: 'FORM_J', name: 'Form J — List of Members' },
    { id: 'FORM_SHARE', name: 'Share Register' },
    { id: 'FORM_NOM', name: 'Nomination Register' },
    { id: 'FORM_PROP', name: 'Property Register' },
    { id: 'FORM_BANK', name: 'Bank Lien Mark Register' },
  ];

  let testCounter = 1;

  for (const formMeta of formsToTest) {
    console.log(`\n--- TESTING FORM: ${formMeta.name} (${formMeta.id}) ---`);

    // -----------------------------------------------------------------
    // TEST A: Serial Range 001-003 (Populated Records)
    // -----------------------------------------------------------------
    console.log(`TEST ${testCounter++}: Serial Range 001-003 for ${formMeta.id}...`);
    const outputSerial = await PdfEngine.generate({
      formId: formMeta.id,
      fromSerial: '001',
      toSerial: '003',
      nonSerialCount: 0,
      workbook: masterWb,
      societyId: socId,
    });

    assert.ok(outputSerial.files.length >= 1, `Must generate PDF file output for 001-003 range in ${formMeta.id}`);
    assert.strictEqual(outputSerial.files[0].filename.includes('001'), true, 'Leading zero preserved in filename');

    const zipPathSerial = await ZipService.createAndSave(outputSerial.files, formMeta.id, '001', '003', tempDir);
    assert.ok(fs.existsSync(zipPathSerial), 'ZIP file created');
    assert.ok(fs.statSync(zipPathSerial).size > 0, 'ZIP file non-zero');
    console.log(`  [PASS] Serial 001-003 generated PDF buffer(s) & verified ZIP at: ${path.basename(zipPathSerial)}`);

    // -----------------------------------------------------------------
    // TEST B: Blank Forms (Count = 3)
    // -----------------------------------------------------------------
    console.log(`TEST ${testCounter++}: Blank Forms (Count = 3) for ${formMeta.id}...`);
    const outputBlank = await PdfEngine.generate({
      formId: formMeta.id,
      fromSerial: '',
      toSerial: '',
      nonSerialCount: 3,
      workbook: masterWb,
      societyId: socId,
    });

    assert.ok(outputBlank.files.length >= 1, `Must generate blank PDF file output for ${formMeta.id}`);
    const zipPathBlank = await ZipService.createAndSave(outputBlank.files, formMeta.id, '', '', tempDir);
    assert.ok(fs.existsSync(zipPathBlank), 'Blank ZIP created');
    assert.ok(fs.statSync(zipPathBlank).size > 0, 'Blank ZIP non-zero');
    console.log(`  [PASS] Blank (count = 3) generated blank PDF buffer(s) & verified ZIP at: ${path.basename(zipPathBlank)}`);

    // -----------------------------------------------------------------
    // TEST C: Mixed Range (001-003 + Blank = 2)
    // -----------------------------------------------------------------
    console.log(`TEST ${testCounter++}: Mixed Range (001-003 + Blank = 2) for ${formMeta.id}...`);
    const outputMixed = await PdfEngine.generate({
      formId: formMeta.id,
      fromSerial: '001',
      toSerial: '003',
      nonSerialCount: 2,
      workbook: masterWb,
      societyId: socId,
    });

    assert.ok(outputMixed.files.length >= 1, `Must generate mixed PDF file output for ${formMeta.id}`);
    const zipPathMixed = await ZipService.createAndSave(outputMixed.files, formMeta.id, '001', '003', tempDir);
    assert.ok(fs.existsSync(zipPathMixed), 'Mixed ZIP created');
    assert.ok(fs.statSync(zipPathMixed).size > 0, 'Mixed ZIP non-zero');
    console.log(`  [PASS] Mixed (3 serial + 2 blank) generated PDF buffer(s) & verified ZIP at: ${path.basename(zipPathMixed)}`);
  }

  // -----------------------------------------------------------------
  // TEST D: EXCEL EXPORT MODULE
  // -----------------------------------------------------------------
  console.log(`\nTEST ${testCounter++}: Excel Export Module Verification...`);
  const excelBuf = MasterDataService.exportIndividualModule(masterWb, 'formJ');
  assert.ok(excelBuf instanceof Buffer, 'Excel export returns Buffer');
  assert.ok(excelBuf.length > 0, 'Excel Buffer is non-zero');
  console.log('  [PASS] Excel export module generated valid buffer for Form J.');

  console.log('\n===========================================================');
  console.log('ALL PROMPT 05/07 FORM GENERATION & EXPORT TESTS PASSED! (100%)');
  console.log('===========================================================');
}

runFormGenerationPipelineTestSuite().catch(err => {
  console.error('\n❌ PROMPT 05/07 TEST SUITE FAILED:', err);
  process.exit(1);
});
