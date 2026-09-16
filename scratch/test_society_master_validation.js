// ============================================================
// HENU OS — Society Master Extraction & Validation Test
// ============================================================

const XLSX = require('xlsx');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { ValidationEngine } = require('../dist/main/services/ValidationEngine');

function testSocietyMasterExtraction() {
  console.log('==================================================');
  console.log('HENU OS — SOCIETY MASTER EXTRACTION TEST');
  console.log('==================================================\n');

  // 1. Generate master template buffer
  const buf = MasterDataService.generateTemplate();
  const wb = XLSX.read(buf, { type: 'buffer' });

  // Populate sample values into Society Master sheet
  const smSheet = wb.Sheets['Society Master'];

  // Fill sample values matching template structure:
  // Row 1: Field | Value
  // Row 2: Society Name | SHREE GANESH CHS LTD
  // Row 3: Society Registration No. | MUM/MH/HSG/12345/2010
  // Row 4: Society Registration Date | 15/08/2010
  // Row 5: Society Address | Plot 42, Vashi, Navi Mumbai
  // Row 6: Society Email ID | shreeganesh@gmail.com
  // Row 7: Society Telephone / Mobile No. | 9876543210
  // Row 8: Total Unit | 18
  // Row 9: No. of Flat or Room | 18
  // Row 10: No. Shop | 0
  // Row 11: No. Office | 0
  // Row 12: No. Galas | 0
  // Row 13: No. of Print Blank (EXTRA SR. No.) | 5

  smSheet['B2'] = { v: 'SHREE GANESH CO-OPERATIVE HOUSING SOCIETY LTD.', t: 's' };
  smSheet['B3'] = { v: 'MUM/MH/HSG/12345/2010', t: 's' };
  smSheet['B4'] = { v: '15/08/2010', t: 's' };
  smSheet['B5'] = { v: 'Plot No. 42, Sector 15, Vashi, Navi Mumbai - 400703', t: 's' };
  smSheet['B6'] = { v: 'shreeganesh.chs@gmail.com', t: 's' };
  smSheet['B7'] = { v: '9876543210', t: 's' };
  smSheet['B8'] = { v: 18, t: 'n' };
  smSheet['B9'] = { v: 18, t: 'n' };
  smSheet['B10'] = { v: 0, t: 'n' };
  smSheet['B11'] = { v: 0, t: 'n' };
  smSheet['B12'] = { v: 0, t: 'n' };
  smSheet['B13'] = { v: 5, t: 'n' };

  // Add dummy Common File record so workbook is valid
  const cfSheet = wb.Sheets['Common File'];
  cfSheet['A3'] = { v: '001', t: 's' };
  cfSheet['B3'] = { v: 'M-001', t: 's' };
  cfSheet['C3'] = { v: 'SC-101', t: 's' };
  cfSheet['I3'] = { v: 'RAMESH CHANDRA SHARMA', t: 's' };

  // Parse workbook
  const parsed = MasterDataService.parseXlsxWorkbook(wb, 'test_society.xlsx');

  console.log('Extracted Society Master:');
  console.dir(parsed.societyMaster, { depth: null });

  const sm = parsed.societyMaster;
  const passName = sm && sm.societyName.includes('SHREE GANESH');
  const passRegNo = sm && sm.registrationNo === 'MUM/MH/HSG/12345/2010';
  const passRegDate = sm && sm.registrationDate === '15/08/2010';
  const passEmail = sm && sm.email === 'shreeganesh.chs@gmail.com';
  const passTel = sm && sm.telephone === '9876543210';
  const passUnits = sm && sm.totalUnits === 18 && sm.unitsFlat === 18;

  // Run validation engine
  const valResult = ValidationEngine.validateWorkbook(parsed);
  console.log('\nValidation Warnings:', valResult.warnings);

  const hasBlankRegDateWarn = valResult.warnings.some(w => w.includes('Registration Date is blank'));
  const hasBlankEmailWarn = valResult.warnings.some(w => w.includes('Society Email Id is blank'));
  const hasBlankTelWarn = valResult.warnings.some(w => w.includes('Society Telephone or Mobile No. is blank'));
  const hasUnitWarn = valResult.warnings.some(w => w.includes('Total Unit breakdown is 0'));

  console.log(`- Registration Date Extracted: ${passRegDate ? 'PASS' : 'FAIL'}`);
  console.log(`- Email Extracted: ${passEmail ? 'PASS' : 'FAIL'}`);
  console.log(`- Telephone Extracted: ${passTel ? 'PASS' : 'FAIL'}`);
  console.log(`- Units Extracted: ${passUnits ? 'PASS' : 'FAIL'}`);

  console.log(`- Registration Date Warning Suppressed: ${!hasBlankRegDateWarn ? 'PASS' : 'FAIL'}`);
  console.log(`- Email Warning Suppressed: ${!hasBlankEmailWarn ? 'PASS' : 'FAIL'}`);
  console.log(`- Telephone Warning Suppressed: ${!hasBlankTelWarn ? 'PASS' : 'FAIL'}`);
  console.log(`- Units Breakdown Warning Suppressed: ${!hasUnitWarn ? 'PASS' : 'FAIL'}`);

  if (passRegDate && passEmail && passTel && passUnits && !hasBlankRegDateWarn && !hasBlankEmailWarn && !hasBlankTelWarn && !hasUnitWarn) {
    console.log('\n==================================================');
    console.log('SOCIETY MASTER EXTRACTION & VALIDATION: 100% PASS');
    console.log('==================================================');
  } else {
    console.error('\n[FAIL] Society Master extraction verification failed.');
    process.exit(1);
  }
}

testSocietyMasterExtraction();
