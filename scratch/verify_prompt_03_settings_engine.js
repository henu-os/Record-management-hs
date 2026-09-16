// ============================================================
// Acceptance Test Suite for PROMPT 03 — Form Design Configuration Engine
// Verifies Color Mode, Grid ON/OFF, Grid Thickness, Grid Opacity,
// per-form settings isolation, persistence, reset, and PDF rendering.
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');
const { DEFAULT_FORM_DESIGN_SETTINGS } = require('../dist/main/types.js');

async function runAcceptanceTest() {
  console.log('=== STARTING PROMPT 03 ACCEPTANCE TEST SUITE ===\n');

  // Initialize DB & clean table for test isolation
  initializeDatabase();
  const db = getDatabase();
  db.prepare('DELETE FROM settings').run();

  // STEP 1: Verify Default Settings Schema & Clamping
  console.log('STEP 1: Testing FormDesignSettings clamping & default values...');
  const clampedDef = FormDesignSettingsService.clampSettings({});
  assert.strictEqual(clampedDef.colorMode, 'Color', 'Default colorMode must be Color');
  assert.strictEqual(clampedDef.gridOn, true, 'Default gridOn must be true');
  assert.strictEqual(clampedDef.gridOpacity, 100, 'Default gridOpacity must be 100');
  assert.strictEqual(clampedDef.gridThickness, 0.5, 'Default gridThickness must be 0.5');

  const clampedCustom = FormDesignSettingsService.clampSettings({
    colorMode: 'BW',
    gridOn: false,
    gridOpacity: 35,
    gridThickness: 0.75,
    fontSize: 15, // Out of bounds (max 12)
    headerFontSize: 5, // Out of bounds (min 8)
  });
  assert.strictEqual(clampedCustom.colorMode, 'BW');
  assert.strictEqual(clampedCustom.gridOn, false);
  assert.strictEqual(clampedCustom.gridOpacity, 35);
  assert.strictEqual(clampedCustom.gridThickness, 0.75);
  assert.strictEqual(clampedCustom.fontSize, 12, 'fontSize must be clamped to max 12');
  assert.strictEqual(clampedCustom.headerFontSize, 8, 'headerFontSize must be clamped to min 8');
  console.log('  [PASS] Clamping & defaults verified.\n');

  // STEP 2: Verify Per-Form Settings Isolation
  console.log('STEP 2: Testing Per-Form Settings Isolation (Form I vs Form J vs Global)...');
  FormDesignSettingsService.saveSettings('FORM_I', {
    colorMode: 'Color',
    gridOn: true,
    gridOpacity: 35,
    gridThickness: 0.5,
    textColor: '#112233',
  });

  FormDesignSettingsService.saveSettings('FORM_J', {
    colorMode: 'BW',
    gridOn: false,
    gridOpacity: 80,
    gridThickness: 1.0,
    textColor: '#000000',
  });

  const formISettings = FormDesignSettingsService.getResolvedSettings('FORM_I');
  const formJSettings = FormDesignSettingsService.getResolvedSettings('FORM_J');

  assert.strictEqual(formISettings.colorMode, 'Color', 'Form I colorMode must be Color');
  assert.strictEqual(formISettings.gridOpacity, 35, 'Form I gridOpacity must be 35');
  assert.strictEqual(formISettings.textColor, '#112233');

  assert.strictEqual(formJSettings.colorMode, 'BW', 'Form J colorMode must be BW');
  assert.strictEqual(formJSettings.gridOn, false, 'Form J gridOn must be false');
  assert.strictEqual(formJSettings.gridOpacity, 80);
  assert.strictEqual(formJSettings.gridThickness, 1.0);

  console.log('  [PASS] Form I settings do NOT overwrite Form J settings.\n');

  // STEP 3: Verify Global Defaults Fallback & Reset Scope
  console.log('STEP 3: Testing Global Defaults Fallback & Reset Scope...');
  // Clear form-specific overrides for FORM_SHARE so it inherits global
  FormDesignSettingsService.resetFormSettings('FORM_SHARE');

  FormDesignSettingsService.saveSettings('global', {
    fontFamily: 'Courier',
    brandingText: 'HENU TEST BRANDING',
  });

  const formShareSettings = FormDesignSettingsService.getResolvedSettings('FORM_SHARE');
  assert.strictEqual(formShareSettings.fontFamily, 'Courier', 'Form SHARE should inherit Global default fontFamily');
  assert.strictEqual(formShareSettings.brandingText, 'HENU TEST BRANDING', 'Form SHARE should inherit Global default brandingText');

  // Reset FORM_I only
  const resetFormI = FormDesignSettingsService.resetFormSettings('FORM_I');
  assert.strictEqual(resetFormI.gridOpacity, 100, 'FORM_I reset should restore global/default opacity 100');
  // Check Form J remains unaffected
  const formJAfterReset = FormDesignSettingsService.getResolvedSettings('FORM_J');
  assert.strictEqual(formJAfterReset.colorMode, 'BW', 'Form J settings must remain untouched after Form I reset');

  // Clean up global reset
  FormDesignSettingsService.resetGlobalSettings();
  console.log('  [PASS] Global fallback & scoped reset verified.\n');

  // STEP 4: End-to-End PDF Engine Generation Validation
  console.log('STEP 4: Testing Native PDF Engine Generation with Color, B&W, and Grid settings...');
  const mockWorkbook = {
    societyMaster: {
      societyName: 'TEST SOCIETY LTD',
      registrationNo: 'REG/123/2026',
      registrationDate: '01/01/2026',
      address: '123 Test Street, Mumbai',
      email: 'test@society.com',
      telephone: '9876543210',
      totalUnits: 10, unitsFlat: 10, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0
    },
    commonFile: [
      { memberId: 'm1', srNo: '001', memberName: 'Jethalal Gada', flatNo: 'B-101', wing: 'B', occupancyStatus: 'Owner' },
      { memberId: 'm2', srNo: '002', memberName: 'Taarak Mehta', flatNo: 'B-102', wing: 'B', occupancyStatus: 'Owner' }
    ],
    formIData: [
      { memberId: 'm1', srNo: '001', memberName: 'Jethalal Gada', dateOfAdmission: '01/01/2020' },
      { memberId: 'm2', srNo: '002', memberName: 'Taarak Mehta', dateOfAdmission: '02/01/2020' }
    ],
    formJData: [
      { memberId: 'm1', srNo: '001', memberName: 'Jethalal Gada' },
      { memberId: 'm2', srNo: '002', memberName: 'Taarak Mehta' }
    ],
    shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'TestWorkbook.xlsx', validationErrors: [], validationWarnings: []
  };

  // Test 4A: Color + Grid ON + 35% opacity + 0.5pt thickness
  console.log('  4A. Generating PDF (Color, Grid ON, 35% opacity, 0.5pt thickness)...');
  const res1 = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '002',
    workbook: mockWorkbook,
    renderMode: 'Color',
    gridOn: true,
    settings: { gridOpacity: 35, gridThickness: 0.5 }
  });
  assert.ok(res1.files.length > 0 && res1.files[0].buffer.length > 0, 'PDF buffer generated');
  console.log(`    -> PDF Generated Successfully (${res1.files[0].buffer.length} bytes)`);

  // Test 4B: B&W Mode
  console.log('  4B. Generating PDF (B&W Mode)...');
  const res2 = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '002',
    workbook: mockWorkbook,
    renderMode: 'BW',
    gridOn: true,
    settings: { gridOpacity: 100 }
  });
  assert.ok(res2.files.length > 0 && res2.files[0].buffer.length > 0, 'B&W PDF buffer generated');
  console.log(`    -> B&W PDF Generated Successfully (${res2.files[0].buffer.length} bytes)`);

  // Test 4C: Grid OFF Mode
  console.log('  4C. Generating PDF (Grid OFF)...');
  const res3 = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '002',
    workbook: mockWorkbook,
    renderMode: 'Color',
    gridOn: false,
  });
  assert.ok(res3.files.length > 0 && res3.files[0].buffer.length > 0, 'Grid OFF PDF buffer generated');
  console.log(`    -> Grid OFF PDF Generated Successfully (${res3.files[0].buffer.length} bytes)`);

  // Test 4D: Grid ON + 80% opacity + 1.0pt thickness
  console.log('  4D. Generating PDF (Grid ON, 80% opacity, 1.0pt thickness)...');
  const res4 = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '002',
    workbook: mockWorkbook,
    renderMode: 'Color',
    gridOn: true,
    settings: { gridOpacity: 80, gridThickness: 1.0 }
  });
  assert.ok(res4.files.length > 0 && res4.files[0].buffer.length > 0, 'High Opacity PDF buffer generated');
  console.log(`    -> High Opacity PDF Generated Successfully (${res4.files[0].buffer.length} bytes)`);

  console.log('\n=== ALL PROMPT 03 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
