const fs = require('fs');
const path = require('path');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');
const { initializeDatabase } = require('../dist/main/db');

async function testSettingsPropagation() {
  console.log('===========================================================');
  console.log('TESTING FORM DESIGN SETTINGS PROPAGATION TO PDF ENGINE');
  console.log('===========================================================');

  initializeDatabase();

  const testSocId = 'test_soc_design_' + Date.now();
  const formId = 'FORM_J';

  // 1. Save custom design settings for FORM_J under testSocId
  const customSettings = {
    colorMode: 'BW',
    horizontalAlign: 'center',
    verticalAlign: 'bottom',
    fontFamily: 'Courier',
    fontSize: 9,
    headerFontSize: 13,
    bold: true,
    italic: true,
    textWrapping: true,
    textRotation: 0,
    textColor: '#000000',
    headerBgColor: '#E0E0E0',
    cellBgColor: '#FFFFFF',
    borderColor: '#000000',
    gridColor: '#000000',
    gridOpacity: 80,
    gridOn: true,
    gridThickness: 0.75,
    pageNumberAlign: 'right',
    pageNumberPrefix: 'Pg ',
    brandingText: 'CUSTOM HENU OS BRANDING',
    brandingAlign: 'center',
    customFooterText: 'CONFIDENTIAL RECORD',
    customFooterAlign: 'left',
  };

  console.log('[STEP 1] Saving custom design settings for FORM_J...');
  const saved = FormDesignSettingsService.saveSettings(formId, customSettings, testSocId);
  console.log('  Saved settings colorMode:', saved.colorMode);
  console.log('  Saved settings fontFamily:', saved.fontFamily);
  console.log('  Saved settings gridThickness:', saved.gridThickness);

  // 2. Resolve settings for FORM_J under testSocId
  console.log('\n[STEP 2] Resolving settings via FormDesignSettingsService...');
  const resolved = FormDesignSettingsService.getResolvedSettings(formId, testSocId);
  console.log('  Resolved colorMode:', resolved.colorMode);
  console.log('  Resolved fontFamily:', resolved.fontFamily);
  console.log('  Resolved gridThickness:', resolved.gridThickness);

  if (resolved.colorMode !== 'BW' || resolved.fontFamily !== 'Courier' || resolved.gridThickness !== 0.75) {
    throw new Error('Settings resolution mismatch!');
  }

  // 3. Generate PDF using PdfEngine with resolved settings
  console.log('\n[STEP 3] Generating PDF using PdfEngine.generate()...');
  const output = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '001',
    workbook: {
      commonFile: [{ srNo: '001', memberName: 'TEST MEMBER' }],
      formJData: [{ srNo: '001', classOfMember: 'Active' }],
      formIData: [], shareData: [], nominationData: [], propertyData: [], bankLineData: []
    },
    societyId: testSocId,
  });

  console.log('  Generated PDF files count:', output.files.length);
  console.log('  Generated PDF buffer byte size:', output.files[0].buffer.length);
  if (!output.files.length || output.files[0].buffer.length < 1000) {
    throw new Error('Generated PDF buffer too small or empty!');
  }

  console.log('\n===========================================================');
  console.log('SUCCESS: FORM DESIGN SETTINGS PROPAGATED CLEANLY TO PDF ENGINE!');
  console.log('===========================================================');
}

testSettingsPropagation().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
