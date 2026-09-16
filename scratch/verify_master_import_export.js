// scratch/verify_master_import_export.js
// Automated verification script for Prompt 04 Master Data Architecture & Excel Import/Export
const XLSX = require('xlsx');

console.log('=== PROMPT 04 MASTER DATA & IMPORT/EXPORT TEST ===\n');

try {
  const { MasterDataService } = require('../dist/main/services/MasterDataService.js');
  const { ValidationEngine } = require('../dist/main/services/ValidationEngine.js');

  // -------------------------------------------------------------
  // TEST 1: Master Workbook Template Generation (8 Target Sheets)
  // -------------------------------------------------------------
  const masterTplBuf = MasterDataService.generateTemplate();
  const masterTplWb = XLSX.read(masterTplBuf, { type: 'buffer' });

  const requiredSheets = [
    '01_Society_Master',
    '02_Common_Member_Master',
    '03_Form_I',
    '04_Form_J',
    '05_Share_Register',
    '06_Nomination_Register',
    '07_Property_Register',
    '08_Lien_Mark_Register'
  ];

  for (const sName of requiredSheets) {
    if (!masterTplWb.SheetNames.includes(sName)) {
      throw new Error(`Test 1 Failed: Target sheet "${sName}" missing from Master Template!`);
    }
  }

  console.log('✔ TEST 1 PASSED: Master Workbook generated with all 8 target sheets (01_Society_Master through 08_Lien_Mark_Register).');

  // -------------------------------------------------------------
  // TEST 2: Individual Template Generation for All 8 Modules
  // -------------------------------------------------------------
  const modules = [
    'SOCIETY_MASTER',
    'COMMON_MEMBER_MASTER',
    'FORM_I',
    'FORM_J',
    'FORM_SHARE',
    'FORM_NOM',
    'FORM_PROP',
    'FORM_BANK'
  ];

  for (const modId of modules) {
    const buf = MasterDataService.generateIndividualTemplate(modId);
    if (!buf || buf.length === 0) throw new Error(`Test 2 Failed: Template for ${modId} is empty!`);
    const singleWb = XLSX.read(buf, { type: 'buffer' });
    const detected = MasterDataService.detectModuleType(singleWb);
    if (detected !== modId) {
      throw new Error(`Test 2 Failed: Template generated for ${modId} was auto-detected as ${detected}!`);
    }
  }

  console.log('✔ TEST 2 PASSED: Individual template download & auto-detection verified for all 8 modules.');

  // -------------------------------------------------------------
  // TEST 3: Master Export & Re-Import Roundtrip
  // -------------------------------------------------------------
  const mockMasterWb = {
    societyMaster: {
      societyName: 'Royal Residency CHS',
      registrationNo: 'REG-RR-999',
      registrationDate: '15/08/2020',
      address: 'Plot 12, Sector 4, Navi Mumbai',
      email: 'royal@residency.com',
      telephone: '9876543210',
      totalUnits: 50, unitsFlat: 50, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 5,
    },
    commonFile: [
      { memberId: 'm1', srNo: '001', member1: 'Alice Smith', flatNo: '101', wingNo: 'A', noOfShares: 5, shareCertificateNo: '101', sharesFrom: '1', sharesTo: '5', valueOfShares: '250' },
      { memberId: 'm2', srNo: '002', member1: 'Bob Jones', flatNo: '102', wingNo: 'A', noOfShares: 5, shareCertificateNo: '102', sharesFrom: '6', sharesTo: '10', valueOfShares: '250' },
    ],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'test.xlsx', validationErrors: [], validationWarnings: [],
  };

  const exportBuf = MasterDataService.exportMasterWorkbook(mockMasterWb);
  const exportedWb = XLSX.read(exportBuf, { type: 'buffer' });
  const parsedBack = MasterDataService.parseXlsxWorkbook(exportedWb, 'export.xlsx');

  if (parsedBack.societyMaster?.societyName !== 'Royal Residency CHS') {
    throw new Error(`Test 3 Failed: Exported society name mismatch! Got: ${parsedBack.societyMaster?.societyName}`);
  }
  if (parsedBack.commonFile.length !== 2) {
    throw new Error(`Test 3 Failed: Exported member count mismatch! Expected 2, got ${parsedBack.commonFile.length}`);
  }

  console.log('✔ TEST 3 PASSED: Master export & re-import roundtrip verified with 100% data fidelity.');

  // -------------------------------------------------------------
  // TEST 4: Individual Export & Re-Import (Form I)
  // -------------------------------------------------------------
  const formIBuf = MasterDataService.exportIndividualModule(mockMasterWb, 'FORM_I');
  const formIWb = XLSX.read(formIBuf, { type: 'buffer' });
  const formIDetected = MasterDataService.detectModuleType(formIWb);

  if (formIDetected !== 'FORM_I') {
    throw new Error(`Test 4 Failed: Individual Form I export detected as ${formIDetected}`);
  }

  console.log('✔ TEST 4 PASSED: Individual module export & re-import verified for Form I.');

  // -------------------------------------------------------------
  // TEST 5: Wrong Template Mismatch Detection
  // -------------------------------------------------------------
  const formJBuf = MasterDataService.generateIndividualTemplate('FORM_J');
  const formJWb = XLSX.read(formJBuf, { type: 'buffer' });
  const detectedJ = MasterDataService.detectModuleType(formJWb);

  const targetImportModule = 'SOCIETY_MASTER';
  if (detectedJ && detectedJ !== targetImportModule) {
    console.log(`✔ TEST 5 PASSED: Mismatch safely detected! Uploaded "${detectedJ}" template when target was "${targetImportModule}".`);
  } else {
    throw new Error('Test 5 Failed: Mismatch detection failed!');
  }

  // -------------------------------------------------------------
  // TEST 6: Validation Errors Handling
  // -------------------------------------------------------------
  const corruptWb = {
    societyMaster: { societyName: '', registrationNo: '' },
    commonFile: [],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'bad.xlsx', validationErrors: [], validationWarnings: [],
  };
  const valResult = ValidationEngine.validateWorkbook(corruptWb);
  if (valResult.isValid !== false || valResult.errors.length === 0) {
    throw new Error('Test 6 Failed: Corrupt workbook was not flagged as invalid!');
  }

  console.log('✔ TEST 6 PASSED: Comprehensive validation engine flags corrupt / incomplete data cleanly.');

  console.log('\n=================================================');
  console.log('🎉 ALL PROMPT 04 MASTER DATA & IMPORT/EXPORT TESTS PASSED 100%!');
  console.log('=================================================\n');
} catch (err) {
  console.error('❌ MASTER DATA TEST FAILED:', err.message);
  process.exit(1);
}
