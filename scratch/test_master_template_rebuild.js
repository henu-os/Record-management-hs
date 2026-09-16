const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

console.log('==================================================');
console.log('HENU OS — MASTER TEMPLATE REBUILD VERIFICATION');
console.log('==================================================\n');

try {
  // 1. Generate Template Buffer
  const buffer = MasterDataService.generateTemplate();
  console.log(`[PASS] Generated Master Template Buffer: ${buffer.length} bytes`);

  // 2. Read generated XLSX
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormulas: true });
  
  // 3. Verify Sheet Count & Names (exactly 9)
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
  console.log('[PASS] All 9 required sheets exist with exact names.\n');

  // 4. Verify Notes & Rules sheet contains instructions
  const notesSheet = wb.Sheets['Notes & Rules'];
  const notesRows = XLSX.utils.sheet_to_json(notesSheet, { header: 1 });
  console.log('Notes & Rules Title:', notesRows[0]?.[0]);
  if (!String(notesRows[0]?.[0]).includes('OPERATIONAL INSTRUCTIONS & RULES')) {
    throw new Error('Notes & Rules sheet title mismatch');
  }
  console.log('[PASS] "Notes & Rules" sheet contains documentation instructions.\n');

  // 5. Test parsing template with MasterDataService & verify Notes & Rules is ignored
  const parsedWb = MasterDataService.parseXlsxWorkbook(wb, 'HENU_OS_Master_Template.xlsx');
  console.log('Parsed Master Workbook LoadedAt:', parsedWb.loadedAt);
  console.log('Validation Errors:', parsedWb.validationErrors);
  console.log('Validation Warnings:', parsedWb.validationWarnings);

  if (parsedWb.validationErrors.length > 0) {
    throw new Error(`Validation errors on template: ${parsedWb.validationErrors.join(', ')}`);
  }
  console.log('[PASS] Template parsed by MasterDataService with 0 validation errors.\n');

  // 6. Verify formulas in I Form sheet
  const f1Sheet = wb.Sheets['I Form'];
  const formulaCell = f1Sheet['A4'];
  console.log('Formula in I Form A4:', formulaCell?.f);
  if (!formulaCell || !formulaCell.f || !formulaCell.f.includes('Common File')) {
    throw new Error('Formula linking to Common File missing in I Form cell A4');
  }
  console.log('[PASS] Excel formulas cleanly link register sheets to "Common File".\n');

  console.log('==================================================');
  console.log('ALL MASTER TEMPLATE REBUILD TESTS PASSED 100%');
  console.log('==================================================');

} catch (err) {
  console.error('[FAIL] Master Template Rebuild Error:', err.message);
  process.exit(1);
}
