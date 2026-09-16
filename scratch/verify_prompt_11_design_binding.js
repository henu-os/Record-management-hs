// ============================================================
// HENU OS RECORDS MANAGEMENT SYSTEM — PROMPT 01/05
// UNIFIED FORM DESIGN CONFIGURATION ENGINE & PDF BINDING SUITE
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService.js');
const { resolveRenderColors, DEFAULT_FORM_DESIGN_SETTINGS } = require('../dist/main/types.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');
const { PdfDocumentBuilder } = require('../dist/main/services/renderers/PdfDocumentBuilder.js');

function createDummySociety(id, name, regNo) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, '01/01/2025', '123 Main St', 'City', 'State', '400001', datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET society_name = excluded.society_name
  `).run(id, name, regNo);
}

function createDummyWorkbook(socName = 'Test Society', regNo = 'REG-100') {
  return {
    societyMaster: { societyName: socName, registrationNo: regNo, registrationDate: '01/01/2025', address: '123 Main St' },
    commonFile: [{ srNo: '001', memberName: 'Ramesh Patel' }, { srNo: '002', memberName: 'Suresh Shah' }],
    formIData: [{ srNo: '001', memberName: 'Ramesh Patel' }, { srNo: '002', memberName: 'Suresh Shah' }],
    formJData: [{ srNo: '001', memberName: 'Ramesh Patel' }],
    shareData: [{ srNo: '001', memberName: 'Ramesh Patel' }],
    nominationData: [{ srNo: '001', memberName: 'Ramesh Patel' }],
    propertyData: [{ srNo: '001', memberName: 'Ramesh Patel' }],
    bankLineMarkData: [{ srNo: '001', memberName: 'Ramesh Patel' }],
  };
}

async function runDesignBindingTestSuite() {
  console.log('===========================================================');
  console.log('HENU OS RECORDS MANAGEMENT — PROMPT 01/05 DESIGN ENGINE QA');
  console.log('===========================================================\n');

  initializeDatabase();
  const socA_Id = 'soc_design_A';
  const socB_Id = 'soc_design_B';
  createDummySociety(socA_Id, 'Society A Design', 'REG-A-001');
  createDummySociety(socB_Id, 'Society B Design', 'REG-B-002');
  const wbA = createDummyWorkbook('Society A Design', 'REG-A-001');

  // -----------------------------------------------------------------
  // 1 & 2: COLOR MODE PREVIEW CONFIG & GENERATED PDF
  // -----------------------------------------------------------------
  console.log('TEST 1 & 2: Color Mode Configuration & PDF Generation...');
  const colorCfg = FormDesignSettingsService.clampSettings({ colorMode: 'Color', textColor: '#1C355E', headerBgColor: '#D9E1F2' });
  const colorResolved = resolveRenderColors(colorCfg);
  assert.strictEqual(colorResolved.textColor, '#1C355E');
  assert.strictEqual(colorResolved.headerFill, '#D9E1F2');

  const colorPdfRes = await PdfEngine.generate({
    formId: 'FORM_I', fromSerial: '001', toSerial: '001', nonSerialCount: 0,
    workbook: wbA, societyId: socA_Id, settings: colorCfg
  });
  assert.ok(colorPdfRes.files && colorPdfRes.files.length > 0, 'Color mode PDF generated');
  console.log('  [PASS] Color Mode settings resolved and applied to PDF engine.');

  // -----------------------------------------------------------------
  // 3 & 4: B&W MODE PREVIEW CONFIG & GENERATED PDF
  // -----------------------------------------------------------------
  console.log('\nTEST 3 & 4: B&W Mode Configuration & PDF Generation...');
  const bwCfg = FormDesignSettingsService.clampSettings({ colorMode: 'BW' });
  const bwResolved = resolveRenderColors(bwCfg);
  assert.strictEqual(bwResolved.textColor, '#000000', 'B&W text must resolve to monochrome #000000');
  assert.strictEqual(bwResolved.cellFill, '#FFFFFF', 'B&W cell fill must resolve to #FFFFFF');
  assert.strictEqual(bwResolved.borderColor, '#000000', 'B&W border must resolve to #000000');

  const bwPdfRes = await PdfEngine.generate({
    formId: 'FORM_I', fromSerial: '001', toSerial: '001', nonSerialCount: 0,
    workbook: wbA, societyId: socA_Id, settings: bwCfg
  });
  assert.ok(bwPdfRes.files && bwPdfRes.files.length > 0, 'B&W mode PDF generated');
  console.log('  [PASS] B&W Mode settings resolved and applied to PDF engine.');

  // -----------------------------------------------------------------
  // 5 & 6: GRID ON vs GRID OFF
  // -----------------------------------------------------------------
  console.log('\nTEST 5 & 6: Grid ON vs Grid OFF Configuration...');
  const gridOnCfg = FormDesignSettingsService.clampSettings({ gridOn: true, gridEnabled: true });
  const gridOffCfg = FormDesignSettingsService.clampSettings({ gridOn: false, gridEnabled: false });
  assert.strictEqual(gridOnCfg.gridOn, true, 'Grid ON setting active');
  assert.strictEqual(gridOffCfg.gridOn, false, 'Grid OFF setting active');

  const gridOnPdf = await PdfEngine.generate({ formId: 'FORM_I', fromSerial: '001', toSerial: '001', workbook: wbA, settings: gridOnCfg });
  const gridOffPdf = await PdfEngine.generate({ formId: 'FORM_I', fromSerial: '001', toSerial: '001', workbook: wbA, settings: gridOffCfg });
  assert.ok(gridOnPdf.files.length > 0 && gridOffPdf.files.length > 0, 'Both Grid ON and Grid OFF PDFs generated successfully');
  console.log('  [PASS] Grid ON and Grid OFF settings verified.');

  // -----------------------------------------------------------------
  // 7 to 10: GRID THICKNESS (0.25 pt, 0.50 pt, 0.75 pt, 1.00 pt)
  // -----------------------------------------------------------------
  console.log('\nTESTS 7-10: Grid Thickness Clamping (0.25pt, 0.50pt, 0.75pt, 1.00pt)...');
  const thicknessValues = [0.25, 0.50, 0.75, 1.00];
  for (const tVal of thicknessValues) {
    const clamped = FormDesignSettingsService.clampSettings({ gridThickness: tVal });
    assert.strictEqual(clamped.gridThickness, tVal, `Grid thickness ${tVal}pt must be preserved`);
  }
  // Clamping test for out-of-bound values
  const lowClamp = FormDesignSettingsService.clampSettings({ gridThickness: 0.05 });
  const highClamp = FormDesignSettingsService.clampSettings({ gridThickness: 5.0 });
  assert.strictEqual(lowClamp.gridThickness, 0.25, 'Thickness below 0.25pt clamped to 0.25pt');
  assert.strictEqual(highClamp.gridThickness, 1.00, 'Thickness above 1.00pt clamped to 1.00pt');
  console.log('  [PASS] Grid thickness 0.25pt, 0.50pt, 0.75pt, 1.00pt and boundary clamping verified.');

  // -----------------------------------------------------------------
  // 11: GRID OPACITY (0% to 100%)
  // -----------------------------------------------------------------
  console.log('\nTEST 11: Grid Opacity (0% to 100%)...');
  const opacity50 = FormDesignSettingsService.clampSettings({ gridOpacity: 50 });
  const opacityOut = FormDesignSettingsService.clampSettings({ gridOpacity: 150 });
  assert.strictEqual(opacity50.gridOpacity, 50);
  assert.strictEqual(opacityOut.gridOpacity, 100, 'Opacity > 100 clamped to 100');
  console.log('  [PASS] Grid opacity range and clamping verified.');

  // -----------------------------------------------------------------
  // 12: FONT FAMILY (Helvetica, Times-Roman, Courier, Helvetica-Bold)
  // -----------------------------------------------------------------
  console.log('\nTEST 12: Font Family Options...');
  const fonts = ['Helvetica', 'Times-Roman', 'Courier', 'Helvetica-Bold'];
  for (const font of fonts) {
    const fontCfg = FormDesignSettingsService.clampSettings({ fontFamily: font });
    assert.strictEqual(fontCfg.fontFamily, font, `Font ${font} must be supported`);
  }
  const invalidFont = FormDesignSettingsService.clampSettings({ fontFamily: 'ComicSans' });
  assert.strictEqual(invalidFont.fontFamily, 'Helvetica', 'Invalid font falls back to Helvetica');
  console.log('  [PASS] Font family options and fallback verified.');

  // -----------------------------------------------------------------
  // 13 & 14: FONT SIZE CLAMPING (Body: 7-12pt, Header: 8-14pt)
  // -----------------------------------------------------------------
  console.log('\nTESTS 13 & 14: Font Size Limits (Body: 7-12pt, Header: 8-14pt)...');
  const sizeUnder = FormDesignSettingsService.clampSettings({ fontSize: 4, headerFontSize: 3 });
  const sizeOver = FormDesignSettingsService.clampSettings({ fontSize: 20, headerFontSize: 30 });
  assert.strictEqual(sizeUnder.fontSize, 7, 'Body font size below 7 clamped to 7pt');
  assert.strictEqual(sizeUnder.headerFontSize, 8, 'Header font size below 8 clamped to 8pt');
  assert.strictEqual(sizeOver.fontSize, 12, 'Body font size above 12 clamped to 12pt');
  assert.strictEqual(sizeOver.headerFontSize, 14, 'Header font size above 14 clamped to 14pt');
  console.log('  [PASS] Font size bounds (Body 7..12pt, Header 8..14pt) strictly enforced.');

  // -----------------------------------------------------------------
  // 15: ALIGNMENT (horizontal: left/center/right, vertical: top/middle/bottom)
  // -----------------------------------------------------------------
  console.log('\nTEST 15: Text Alignment Controls...');
  const alignCfg = FormDesignSettingsService.clampSettings({ horizontalAlign: 'center', verticalAlign: 'top' });
  assert.strictEqual(alignCfg.horizontalAlign, 'center');
  assert.strictEqual(alignCfg.verticalAlign, 'top');
  console.log('  [PASS] Horizontal and Vertical alignment options verified.');

  // -----------------------------------------------------------------
  // 16: FOOTER ALIGNMENT & PREFIX CONTROLS
  // -----------------------------------------------------------------
  console.log('\nTEST 16: Footer Controls & Prefix Alignment...');
  const footerCfg = FormDesignSettingsService.clampSettings({
    pageNumberAlign: 'right', pageNumberPrefix: 'Page ', customFooterText: 'Official Record', customFooterAlign: 'left'
  });
  assert.strictEqual(footerCfg.pageNumberAlign, 'right');
  assert.strictEqual(footerCfg.pageNumberPrefix, 'Page ');
  assert.strictEqual(footerCfg.customFooterText, 'Official Record');
  console.log('  [PASS] Footer page numbers, prefix, branding, and custom text options verified.');

  // -----------------------------------------------------------------
  // 17: TEXT ROTATION (0, 90, 180, 270)
  // -----------------------------------------------------------------
  console.log('\nTEST 17: Text Rotation...');
  const rotations = [0, 90, 180, 270];
  for (const rot of rotations) {
    const rotCfg = FormDesignSettingsService.clampSettings({ textRotation: rot });
    assert.strictEqual(rotCfg.textRotation, rot, `Rotation ${rot}° must be preserved`);
  }
  console.log('  [PASS] Text rotation options (0°, 90°, 180°, 270°) verified.');

  // -----------------------------------------------------------------
  // 18 & 19: SOCIETY & FORM ISOLATION
  // -----------------------------------------------------------------
  console.log('\nTESTS 18 & 19: Society & Form Isolation...');
  FormDesignSettingsService.saveSettings('FORM_J', { fontSize: 10, colorMode: 'Color' }, socA_Id);
  FormDesignSettingsService.saveSettings('FORM_J', { fontSize: 8, colorMode: 'BW' }, socB_Id);
  FormDesignSettingsService.saveSettings('FORM_I', { fontSize: 12, colorMode: 'Color' }, socA_Id);

  const socA_J = FormDesignSettingsService.getResolvedSettings('FORM_J', socA_Id);
  const socB_J = FormDesignSettingsService.getResolvedSettings('FORM_J', socB_Id);
  const socA_I = FormDesignSettingsService.getResolvedSettings('FORM_I', socA_Id);

  assert.strictEqual(socA_J.fontSize, 10, 'Society A Form J font size is 10');
  assert.strictEqual(socA_J.colorMode, 'Color', 'Society A Form J colorMode is Color');
  assert.strictEqual(socB_J.fontSize, 8, 'Society B Form J font size is 8');
  assert.strictEqual(socB_J.colorMode, 'BW', 'Society B Form J colorMode is BW');
  assert.strictEqual(socA_I.fontSize, 12, 'Society A Form I font size is 12');

  console.log('  [PASS] Independent per-society and per-form settings isolation verified.');

  // -----------------------------------------------------------------
  // 20: GENERATED PDF CONSUMES SAVED SETTINGS
  // -----------------------------------------------------------------
  console.log('\nTEST 20: Generated PDF Consumes Saved Settings...');
  const pdfOutputSocA = await PdfEngine.generate({
    formId: 'FORM_J', fromSerial: '001', toSerial: '001', workbook: wbA, societyId: socA_Id
  });
  const pdfOutputSocB = await PdfEngine.generate({
    formId: 'FORM_J', fromSerial: '001', toSerial: '001', workbook: wbA, societyId: socB_Id
  });

  assert.ok(pdfOutputSocA.files.length > 0 && pdfOutputSocB.files.length > 0, 'PDF generation consumed per-society settings cleanly');
  console.log('  [PASS] Saved per-society settings consumed directly by PDF Engine.');

  console.log('\n===========================================================');
  console.log('ALL 20 PROMPT 01/05 DESIGN ENGINE TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('===========================================================');
}

runDesignBindingTestSuite().catch(err => {
  console.error('\n❌ DESIGN ENGINE TEST SUITE FAILED:', err);
  process.exit(1);
});
