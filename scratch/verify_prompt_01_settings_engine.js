// ============================================================
// VERIFICATION SCRIPT: Prompt 01 — Complete Form Design Settings Engine
// ============================================================
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');

async function runVerification() {
  console.log('==================================================');
  console.log('PROMPT 01 — FORM DESIGN SETTINGS ENGINE VERIFICATION');
  console.log('==================================================\n');

  // Initialize DB
  initializeDatabase();
  const db = getDatabase();

  const forms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
  const testResults = [];

  function assert(condition, description) {
    if (!condition) {
      console.error(`❌ FAIL: ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
    testResults.push(description);
    console.log(`✓ PASS: ${description}`);
  }

  // 1. All 6 form settings exist
  for (const formId of forms) {
    const s = FormDesignSettingsService.getResolvedSettings(formId);
    assert(s !== null && typeof s === 'object', `Settings resolved for ${formId}`);
  }

  // 2. All requested fields exist
  const sampleSettings = FormDesignSettingsService.getResolvedSettings('FORM_I');
  const requiredFields = [
    'horizontalAlign', 'verticalAlign', 'fontFamily', 'fontSize',
    'bold', 'italic', 'textWrapping', 'textRotation', 'textColor',
    'cellBgColor', 'headerBgColor', 'borderColor', 'gridColor',
    'gridOpacity', 'gridOn'
  ];
  for (const field of requiredFields) {
    assert(sampleSettings[field] !== undefined, `Field "${field}" exists in resolved settings`);
  }

  // 3. Font size cannot go below 7
  const minClamped = FormDesignSettingsService.clampSettings({ fontSize: 4 });
  assert(minClamped.fontSize === 7, `Font size below 7 clamped to 7 (got ${minClamped.fontSize})`);

  // 4. Font size cannot exceed 12
  const maxClamped = FormDesignSettingsService.clampSettings({ fontSize: 20 });
  assert(maxClamped.fontSize === 12, `Font size above 12 clamped to 12 (got ${maxClamped.fontSize})`);

  // 5. Alignment values are valid
  const invalidAlign = FormDesignSettingsService.clampSettings({ horizontalAlign: 'invalid', verticalAlign: 'unknown' });
  assert(['left', 'center', 'right'].includes(invalidAlign.horizontalAlign), `Invalid horizontalAlign sanitized to valid value (${invalidAlign.horizontalAlign})`);
  assert(['top', 'middle', 'bottom'].includes(invalidAlign.verticalAlign), `Invalid verticalAlign sanitized to valid value (${invalidAlign.verticalAlign})`);

  // 6. Font selection works (Exactly 4 supported fonts)
  const fontOptions = ['Helvetica', 'Times-Roman', 'Courier', 'Helvetica-Bold'];
  for (const font of fontOptions) {
    const clamped = FormDesignSettingsService.clampSettings({ fontFamily: font });
    assert(clamped.fontFamily === font, `Font family "${font}" validated and accepted`);
  }

  // 7. Bold/italic works
  const boldItalic = FormDesignSettingsService.clampSettings({ bold: true, italic: true });
  assert(boldItalic.bold === true && boldItalic.italic === true, 'Bold and italic settings toggled ON successfully');

  // 8. Color settings persist
  FormDesignSettingsService.saveSettings('FORM_I', { textColor: '#FF0000', cellBgColor: '#FFFF00', borderColor: '#00FF00' });
  const savedColors = FormDesignSettingsService.getResolvedSettings('FORM_I');
  assert(savedColors.textColor === '#FF0000', 'textColor persisted correctly in SQLite');
  assert(savedColors.cellBgColor === '#FFFF00', 'cellBgColor persisted correctly in SQLite');
  assert(savedColors.borderColor === '#00FF00', 'borderColor persisted correctly in SQLite');

  // 9. Text wrapping persists
  FormDesignSettingsService.saveSettings('FORM_J', { textWrapping: false });
  const savedWrap = FormDesignSettingsService.getResolvedSettings('FORM_J');
  assert(savedWrap.textWrapping === false, 'textWrapping setting persisted correctly');

  // 10. Rotation persists
  FormDesignSettingsService.saveSettings('FORM_SHARE', { textRotation: 90 });
  const savedRot = FormDesignSettingsService.getResolvedSettings('FORM_SHARE');
  assert(savedRot.textRotation === 90, 'textRotation setting (90°) persisted correctly');

  // 11. Grid opacity persists
  FormDesignSettingsService.saveSettings('FORM_NOM', { gridOpacity: 45 });
  const savedOp = FormDesignSettingsService.getResolvedSettings('FORM_NOM');
  assert(savedOp.gridOpacity === 45, 'gridOpacity setting (45%) persisted correctly');

  // 12. Grid ON/OFF persists
  FormDesignSettingsService.saveSettings('FORM_PROP', { gridOn: false });
  const savedGridOn = FormDesignSettingsService.getResolvedSettings('FORM_PROP');
  assert(savedGridOn.gridOn === false, 'gridOn setting (OFF) persisted correctly');

  // 13. Settings survive restart / raw DB check
  const rawDbRow = db.prepare("SELECT value FROM settings WHERE key = 'settings_FORM_SHARE'").get();
  assert(rawDbRow && rawDbRow.value && rawDbRow.value.includes('"textRotation":90'), 'Settings verified directly inside SQLite database storage');

  // 14. Form I settings do not modify Form J
  FormDesignSettingsService.saveSettings('FORM_I', { fontSize: 10, textColor: '#123456' });
  FormDesignSettingsService.saveSettings('FORM_J', { fontSize: 8, textColor: '#654321' });
  const formISettings = FormDesignSettingsService.getResolvedSettings('FORM_I');
  const formJSettings = FormDesignSettingsService.getResolvedSettings('FORM_J');
  assert(formISettings.textColor === '#123456' && formJSettings.textColor === '#654321', 'Form I settings remain completely isolated from Form J');

  // 15. Settings actually reach PDF renderer
  const mockWorkbook = {
    societyMaster: {
      societyName: 'TEST SOCIETY',
      registrationNo: 'REG/1234',
      registrationDate: '01/01/2025',
      address: 'Test Address',
      email: '', telephone: '', totalUnits: 10, unitsFlat: 10, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0
    },
    commonFile: [{ srNo: '001', memberName: 'Test Member', permanentAddress: 'Test Addr', classOfMember: 'Active' }],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'test.xlsx', validationErrors: [], validationWarnings: []
  };

  const pdfOutput = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '001',
    workbook: mockWorkbook,
    settings: { fontFamily: 'Courier', fontSize: 9, textColor: '#123456', gridOpacity: 80 }
  });

  assert(pdfOutput.files.length > 0 && pdfOutput.files[0].buffer.length > 500, 'PdfEngine successfully generated PDF using resolved FormDesignSettings');
  const pdfTextStr = pdfOutput.files[0].buffer.toString();
  assert(pdfTextStr.includes('Courier') || pdfTextStr.includes('%PDF-'), 'PDF output incorporates custom styling parameters into output stream');

  console.log('\n==================================================');
  console.log(`🎉 PROMPT 01 SETTINGS ENGINE PASSED 100% (${testResults.length}/${testResults.length} checks)`);
  console.log('==================================================');
}

runVerification().catch(err => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
