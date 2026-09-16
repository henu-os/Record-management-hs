// ============================================================
// Acceptance Test Suite for PROMPT 05 — Form Header Engine
// Standardizes Line 1 (Name), Line 2 ({Registration No}.: {Date}), Line 3 (Address)
// Across all SIX forms, with multi-society dynamic switching.
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');
const { PDFDocument, PDFRawStream } = require('pdf-lib');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { PdfEngine } = require('../dist/main/services/PdfEngine.js');

async function getPdfText(pdfBuffer) {
  const doc = await PDFDocument.load(pdfBuffer);
  let text = '';
  for (const obj of doc.context.enumerateIndirectObjects()) {
    if (obj[1] instanceof PDFRawStream) {
      try {
        const str = zlib.inflateSync(Buffer.from(obj[1].contents)).toString('latin1');
        const hexes = str.match(/<([0-9A-Fa-f]+)>/g);
        if (hexes) {
          text += hexes.map(h => Buffer.from(h.slice(1, -1), 'hex').toString('utf-8')).join(' ') + '\n';
        }
      } catch (e) {}
    }
  }
  return text;
}

async function runAcceptanceTest() {
  console.log('=== STARTING PROMPT 05 ACCEPTANCE TEST SUITE ===\n');

  initializeDatabase();

  const societyA = {
    societyMaster: {
      societyName: 'HENU OS PVT LTD CO-SOC',
      registrationNo: 'U62099RJ2025PTC109150',
      registrationDate: '02/12/2025',
      address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401',
      email: 'contact@henuos.com', telephone: '9876543210',
      totalUnits: 10, unitsFlat: 10, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0
    },
    commonFile: [
      { memberId: 'm1', srNo: '001', memberName: 'Ramesh Patel', flatNo: 'A-101' }
    ],
    formIData: [{ memberId: 'm1', srNo: '001', memberName: 'Ramesh Patel' }],
    formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'SocietyA.xlsx', validationErrors: [], validationWarnings: []
  };

  const societyB = {
    societyMaster: {
      societyName: 'GOKULDHAM CO-OP HOUSING SOCIETY LTD',
      registrationNo: 'REG/MUM/2026',
      registrationDate: '01/01/2020',
      address: 'Powai Lake Road, Hiranandani, Mumbai, Maharashtra 400076',
      email: 'info@gokuldham.com', telephone: '9123456789',
      totalUnits: 20, unitsFlat: 20, unitsShop: 0, unitsOffice: 0, unitsGala: 0, printBlanks: 0
    },
    commonFile: [
      { memberId: 'm2', srNo: '001', memberName: 'Jethalal Gada', flatNo: 'B-101' }
    ],
    formIData: [{ memberId: 'm2', srNo: '001', memberName: 'Jethalal Gada' }],
    formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: new Date().toISOString(), fileName: 'SocietyB.xlsx', validationErrors: [], validationWarnings: []
  };

  const allForms = [
    { id: 'FORM_I', name: 'Form I' },
    { id: 'FORM_J', name: 'Form J' },
    { id: 'FORM_SHARE', name: 'Share Register' },
    { id: 'FORM_NOM', name: 'Nomination Register' },
    { id: 'FORM_PROP', name: 'Property Register' },
    { id: 'FORM_BANK', name: 'Bank Lien Mark' },
  ];

  // STEP 1: Verify Society A Headers across all 6 forms
  console.log('STEP 1: Testing Society A Headers across all 6 forms...');
  for (const f of allForms) {
    const res = await PdfEngine.generate({
      formId: f.id,
      fromSerial: '001',
      toSerial: '001',
      workbook: societyA,
    });
    assert.ok(res.files.length > 0, `Expected PDF output for ${f.name}`);
    const text = await getPdfText(res.files[0].buffer);

    // Line 1: HENU OS PVT LTD CO-SOC
    assert.ok(text.includes('HENU OS PVT LTD CO-SOC'), `${f.name} must include Society A Name`);
    // Line 2: U62099RJ2025PTC109150.: 02/12/2025
    assert.ok(text.includes('U62099RJ2025PTC109150.: 02/12/2025'), `${f.name} must include compact Line 2 format "U62099RJ2025PTC109150.: 02/12/2025"`);
    // Line 3: Home Bhagesar, 10B-204...
    assert.ok(text.includes('Home Bhagesar') || text.includes('Rajasthan 306401'), `${f.name} must include Society A address`);

    // Verify NO Society B text
    assert.strictEqual(text.includes('GOKULDHAM'), false, `${f.name} must NOT contain Society B data`);
    console.log(`  [PASS] ${f.name} Society A Header verified.`);
  }

  // STEP 2: Verify Society B Headers across all 6 forms (Switching Test)
  console.log('\nSTEP 2: Switching to Society B and testing headers across all 6 forms...');
  for (const f of allForms) {
    const res = await PdfEngine.generate({
      formId: f.id,
      fromSerial: '001',
      toSerial: '001',
      workbook: societyB,
    });
    assert.ok(res.files.length > 0, `Expected PDF output for ${f.name}`);
    const text = await getPdfText(res.files[0].buffer);

    // Line 1: GOKULDHAM CO-OP HOUSING SOCIETY LTD
    assert.ok(text.includes('GOKULDHAM CO-OP HOUSING SOCIETY LTD'), `${f.name} must include Society B Name`);
    // Line 2: REG/MUM/2026.: 01/01/2020
    assert.ok(text.includes('REG/MUM/2026.: 01/01/2020'), `${f.name} must include compact Line 2 format "REG/MUM/2026.: 01/01/2020"`);
    // Line 3: Powai Lake Road...
    assert.ok(text.includes('Powai Lake Road') || text.includes('Maharashtra 400076'), `${f.name} must include Society B address`);

    // Verify NO Society A text
    assert.strictEqual(text.includes('HENU OS PVT LTD CO-SOC'), false, `${f.name} must NOT contain Society A data`);
    console.log(`  [PASS] ${f.name} Society B Header verified.`);
  }

  console.log('\n=== ALL PROMPT 05 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
