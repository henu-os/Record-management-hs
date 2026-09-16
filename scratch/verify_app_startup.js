// ============================================================
// Real-world integration test for HENU OS Records Management
// ============================================================

const path = require('path');
const fs = require('fs');

async function verifyAll() {
  console.log('=== REAL-WORLD INTEGRATION & STARTUP VERIFICATION ===');

  // Load compiled main bundle
  const { initializeDatabase, getPaths } = require('../dist/main/db');
  const { MasterDataService } = require('../dist/main/services/MasterDataService');
  const { MasterDataQueryEngine } = require('../dist/main/services/MasterDataQueryEngine');
  const { ValidationEngine } = require('../dist/main/services/ValidationEngine');
  const { PdfEngine } = require('../dist/main/services/PdfEngine');
  const { ZipService } = require('../dist/main/services/ZipService');

  // 1. Initialize SQLite Database
  console.log('[1] Initializing SQLite database...');
  initializeDatabase();
  console.log('    ✓ SQLite initialized successfully');

  // 2. Generate and Parse Master Excel Workbook
  console.log('[2] Generating official Master Excel Template...');
  const templateBuf = MasterDataService.generateTemplate();
  const tmpWbPath = path.join(__dirname, 'test_master_workbook.xlsx');
  fs.writeFileSync(tmpWbPath, templateBuf);

  console.log('[3] Parsing Master Workbook...');
  const parsedWb = MasterDataService.parseWorkbook(tmpWbPath);
  console.log('    ✓ Master Workbook parsed cleanly');

  // 3. Add real-world test data (001, 002, 003, 005)
  parsedWb.societyMaster = {
    societyName: 'REAL-WORLD SUNSHINE CHS LTD',
    registrationNo: 'BOM/HSG/2026/999',
    registrationDate: '15/08/2020',
    address: 'PLOTS 1-10, SUNSHINE COMPLEX, KOTHRUD, PUNE 411038',
    email: 'contact@sunshinechs.com',
    telephone: '020-25432100',
    totalUnits: 50, unitsFlat: 40, unitsShop: 10, unitsOffice: 0, unitsGala: 0, printBlanks: 5,
  };

  parsedWb.commonFile = [
    { srNo: '001', memberName: 'ARVIND RAMCHANDRA KALE', permanentAddress: 'SHANTI SADAN, KOTHRUD, PUNE' },
    { srNo: '002', memberName: 'RAMESH SURESH SHARMA', permanentAddress: 'FLAT 102, SUNSHINE CHS, PUNE' },
    { srNo: '003', memberName: 'MEENAKSHI ANIL JOSHI', permanentAddress: 'FLAT 103, SUNSHINE CHS, PUNE' },
    { srNo: '005', memberName: 'SUNITA PRAKASH KULKARNI', permanentAddress: 'FLAT 105, SUNSHINE CHS, PUNE' },
  ];

  // 4. Validate Master Workbook
  console.log('[4] Validating Master Workbook...');
  const valResult = ValidationEngine.validateWorkbook(parsedWb);
  console.log(`    ✓ Workbook Validation: isValid = ${valResult.isValid}`);

  // 5. Query serial range 001 to 005 (004 missing)
  console.log('[5] Querying Range 001 -> 005 with missing 004 gap resolution...');
  const queried = MasterDataQueryEngine.queryFormRecords(parsedWb, 'FORM_J', '001', '005');
  console.log(`    ✓ Queried records count: ${queried.length}`);
  console.log(`    ✓ Item 001 name: "${queried[0].record.memberName}"`);
  console.log(`    ✓ Item 004 isBlank: ${queried[3].isBlank}, name: "${queried[3].record.memberName}"`);
  console.log(`    ✓ Item 005 name: "${queried[4].record.memberName}"`);

  // 6. Generate PDFs for all six forms
  const forms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
  console.log('[6] Testing PDF Generation for all 6 Forms...');
  for (const formId of forms) {
    const pdfRes = await PdfEngine.generate({
      formId,
      fromSerial: '001',
      toSerial: '005',
      workbook: parsedWb,
    });
    console.log(`    ✓ ${formId}: ${pdfRes.files.length} file(s) generated natively`);
    for (const f of pdfRes.files) {
      if (f.buffer.toString('utf-8', 0, 5) !== '%PDF-') {
        throw new Error(`Invalid PDF header for ${f.filename}`);
      }
    }

    // 7. Test ZIP packaging
    const zipPath = await ZipService.createAndSave(
      pdfRes.files,
      formId,
      '001',
      '005',
      path.join(__dirname, 'test_zips')
    );
    console.log(`    ✓ ${formId} ZIP saved: ${path.basename(zipPath)}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // Cleanup
  }

  // Cleanup
  if (fs.existsSync(tmpWbPath)) fs.unlinkSync(tmpWbPath);
  const zipDir = path.join(__dirname, 'test_zips');
  if (fs.existsSync(zipDir)) fs.rmdirSync(zipDir, { recursive: true });

  console.log('\n=== REAL-WORLD INTEGRATION & STARTUP VERIFICATION SUCCESSFUL ===');
}

verifyAll().catch(err => {
  console.error('\n❌ INTEGRATION VERIFICATION FAILED:', err);
  process.exit(1);
});
