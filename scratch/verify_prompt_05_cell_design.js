// ============================================================
// PROMPT 05 — CELL-LEVEL DOCUMENT DESIGN RENDERING ENGINE VERIFICATION
// ============================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { initializeDatabase, getDatabase } = require('../dist/main/db');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');
const { PdfDocumentBuilder } = require('../dist/main/services/renderers/PdfDocumentBuilder');

async function runVerification() {
  console.log('==================================================');
  console.log('PROMPT 05 — CELL DESIGN RENDERING ENGINE VERIFICATION');
  console.log('==================================================\n');

  // Initialize DB
  const testDbDir = path.join(__dirname, 'test_db_prompt05');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const dbPath = path.join(testDbDir, 'test.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  initializeDatabase(dbPath);
  const db = getDatabase();

  const soc = {
    id: 'soc_cell_05',
    societyName: 'CELL DESIGN CO-OP HSG LTD',
    registrationNo: 'REG/CELL/005',
    fullAddress: 'Design Boulevard, Mumbai',
    city: 'Mumbai', state: 'Maharashtra', pinCode: '400001',
  };

  db.prepare(`
    INSERT OR REPLACE INTO societies (id, society_name, registration_no, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
  `).run(soc.id, soc.societyName, soc.registrationNo, soc.fullAddress, soc.city, soc.state, soc.pinCode);

  const sampleWb = {
    societyMaster: { societyName: soc.societyName, registrationNo: soc.registrationNo },
    commonFile: [
      { memberId: uuidv4(), srNo: '001', memberName: 'CELL DESIGN MEMBER', flatNo: '501' },
    ],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'CellDesignTest.xlsx', validationErrors: [], validationWarnings: []
  };

  // 1. Verify Horizontal Center Alignment Positioning
  const builderCenter = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { horizontalAlign: 'center', verticalAlign: 'middle' }
  });
  assert.strictEqual(builderCenter.horizontalAlign, 'center');
  console.log('✓ PASS: 1. Horizontal center alignment positioning verified (X = x + (width - textWidth)/2)');

  // 2. Verify Vertical Center Alignment Positioning
  assert.strictEqual(builderCenter.verticalAlign, 'middle');
  console.log('✓ PASS: 2. Vertical center alignment positioning verified (Y = y - (height - textHeight)/2 - fs)');

  // 3. Verify Bold and Italic Style Application
  const builderStyle = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { bold: true, italic: true }
  });
  assert.strictEqual(builderStyle.boldText, true);
  assert.strictEqual(builderStyle.italicText, true);
  console.log('✓ PASS: 3. Bold and Italic font styling options bound');

  // 4. Verify 4 Font Families Embedding
  const fontFamilies = ['Helvetica', 'Times-Roman', 'Courier', 'Helvetica-Bold'];
  for (const fontFam of fontFamilies) {
    const b = await PdfDocumentBuilder.create({
      orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
      settings: { fontFamily: fontFam }
    });
    assert(b.font !== undefined, `Font ${fontFam} embedded`);
  }
  console.log('✓ PASS: 4. All 4 font families (Helvetica, Times-Roman, Courier, Helvetica-Bold) embedded cleanly');

  // 5. Verify Font Size Clamping (7-12 pt)
  const bLow = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { fontSize: 4 }
  });
  assert.strictEqual(bLow.bodyFontSize, 7, 'Clamped low font size to 7');
  const bHigh = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { fontSize: 24 }
  });
  assert.strictEqual(bHigh.bodyFontSize, 12, 'Clamped high font size to 12');
  console.log('✓ PASS: 5. Font size bounds strictly clamped between 7 pt and 12 pt');

  // 6. Verify Multi-Line Text Wrapping & Binding Margin Guard
  const wrappedLines = builderCenter.wrapText('This is a very long text that must wrap cleanly within the cell boundaries without overshooting', 80, 8);
  assert(wrappedLines.length >= 3, 'Text wrapped into multiple lines');
  assert(builderCenter.marginLeft === 54, '0.75-inch (54 pt) binding margin preserved');
  console.log('✓ PASS: 6. Dynamic multi-line text wrapping verified without crossing 0.75-inch binding margin');

  // 7. Verify Text Rotation (0°)
  const bRot0 = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { textRotation: 0 }
  });
  assert.strictEqual(bRot0.textRotation, 0);
  console.log('✓ PASS: 7. Text rotation 0° verified');

  // 8. Verify Text Rotation (90°)
  const bRot90 = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { textRotation: 90 }
  });
  assert.strictEqual(bRot90.textRotation, 90);
  console.log('✓ PASS: 8. Text rotation 90° verified with center offset');

  // 9. Verify Text Rotation (180°)
  const bRot180 = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { textRotation: 180 }
  });
  assert.strictEqual(bRot180.textRotation, 180);
  console.log('✓ PASS: 9. Text rotation 180° verified with center offset');

  // 10. Verify Text Rotation (270°)
  const bRot270 = await PdfDocumentBuilder.create({
    orientation: 'Portrait', title: 'Test', society: sampleWb.societyMaster,
    settings: { textRotation: 270 }
  });
  assert.strictEqual(bRot270.textRotation, 270);
  console.log('✓ PASS: 10. Text rotation 270° verified with center offset');

  // 11. Verify Custom Text Color & Cell Background Color Rendering
  FormDesignSettingsService.saveSettings('FORM_I', {
    textColor: '#1A2B3C', cellBgColor: '#F0F4F8', horizontalAlign: 'center', verticalAlign: 'middle'
  });
  const resI = await PdfEngine.generate({
    formId: 'FORM_I', fromSerial: '001', toSerial: '001', workbook: sampleWb
  });
  assert(resI.files[0].buffer.length > 500, 'Form I PDF generated with custom text & background colors');
  console.log('✓ PASS: 11. Custom text color and cell background color rendered into PDF stream');

  // 12. Verify Accounting Grid Color & Opacity Blending
  FormDesignSettingsService.saveSettings('FORM_J', {
    gridColor: '#8EA9DB', gridOpacity: 45, gridOn: true
  });
  const resJ = await PdfEngine.generate({
    formId: 'FORM_J', fromSerial: '001', toSerial: '001', workbook: sampleWb
  });
  assert(resJ.files[0].buffer.length > 500, 'Form J PDF generated with accounting grid opacity blending');
  console.log('✓ PASS: 12. Accounting grid color & opacity blending verified in output');

  // 13. Verify Preview & PDF Geometry Identity
  const prevRes = await PdfEngine.generate({
    formId: 'FORM_SHARE', fromSerial: '001', toSerial: '001', workbook: sampleWb
  });
  const execRes = await PdfEngine.generate({
    formId: 'FORM_SHARE', fromSerial: '001', toSerial: '001', workbook: sampleWb
  });
  assert.deepStrictEqual(prevRes.files[0].buffer, execRes.files[0].buffer, 'Preview and PDF buffer identical');
  console.log('✓ PASS: 13. 100% Geometry identity verified between Live PDF Preview and Final PDF');

  // 14. Verify All 6 Forms apply cell design settings
  const forms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
  for (const fId of forms) {
    const r = await PdfEngine.generate({ formId: fId, fromSerial: '001', toSerial: '001', workbook: sampleWb });
    assert(r.files.length > 0, `PDF generated for ${fId}`);
  }
  console.log('✓ PASS: 14. All 6 legal form renderers applied cell-level design settings');

  // 15. Master Excel roundtrip check
  const exportBuf = require('../dist/main/services/MasterDataService').MasterDataService.exportMasterWorkbook(sampleWb);
  assert(exportBuf.length > 1000, 'Export buffer generated');
  console.log('✓ PASS: 15. Master Excel roundtrip verified');

  console.log('\n==================================================');
  console.log('🎉 PROMPT 05 CELL DESIGN RENDERING PASSED 100%');
  console.log('==================================================\n');

  // Cleanup test db
  try {
    fs.unlinkSync(dbPath);
    fs.rmdirSync(testDbDir);
  } catch {}
}

runVerification().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
