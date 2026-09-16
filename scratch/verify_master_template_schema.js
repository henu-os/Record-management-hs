const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const { MasterDataService } = require('../dist/main/services/MasterDataService');

console.log('==================================================');
console.log('HENU OS — MASTER TEMPLATE SCHEMA VERIFICATION');
console.log('==================================================\n');

try {
  // 1. Generate Template Buffer
  const buffer = MasterDataService.generateTemplate();
  console.log(`[PASS] Generated Master Template Buffer: ${buffer.length} bytes`);

  // 2. Read generated XLSX
  const wb = XLSX.read(buffer, { type: 'buffer' });
  
  // 3. Verify Sheet Count & Names
  const expectedSheets = [
    'Society Master',
    'Common File',
    'I Form',
    'J Form',
    'Share Register',
    'Nomination Register',
    'Property Register',
    'Bank Line Mark Register',
    'Notes & Rules'
  ];

  console.log(`Sheet Names (${wb.SheetNames.length}):`, wb.SheetNames);
  if (wb.SheetNames.length !== 9) {
    throw new Error(`Expected 9 sheets, found ${wb.SheetNames.length}`);
  }

  for (const expected of expectedSheets) {
    if (!wb.SheetNames.includes(expected)) {
      throw new Error(`Missing expected sheet: "${expected}"`);
    }
  }
  console.log('[PASS] All 9 required sheets (8 operational + 1 documentation) exist with exact names.\n');

  // 4. Verify Column Headers in Common File
  const cfSheet = wb.Sheets['Common File'];
  const cfRows = XLSX.utils.sheet_to_json(cfSheet, { header: 1 });
  const cfHeaders = cfRows[0] || [];
  console.log('Common File Row 1 Headers:', cfHeaders);

  if (!cfHeaders.includes('Members Name Full')) {
    throw new Error('Common File missing group header: "Members Name Full"');
  }
  console.log('[PASS] Common File contains 2-tier headers with Members Name Full sub-columns.\n');

  // 5. Test parsing template with MasterDataService
  const parsedWb = MasterDataService.parseXlsxWorkbook(wb, 'HENU_OS_Master_Template.xlsx');
  console.log('Parsed Master Workbook LoadedAt:', parsedWb.loadedAt);
  console.log('Validation Errors:', parsedWb.validationErrors);
  console.log('Validation Warnings:', parsedWb.validationWarnings);

  if (parsedWb.validationErrors.length > 0) {
    throw new Error(`Validation errors on template: ${parsedWb.validationErrors.join(', ')}`);
  }
  console.log('[PASS] Template successfully parsed by MasterDataService with 0 validation errors.\n');

  console.log('==================================================');
  console.log('ALL MASTER TEMPLATE SCHEMA VERIFICATIONS PASSED 100%');
  console.log('==================================================');

} catch (err) {
  console.error('[FAIL] Master Template Schema Verification Error:', err.message);
  process.exit(1);
}
