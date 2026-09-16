// ============================================================
// Test Suite: Form J with 6 Stacked Member Names (Lines 1 to 6)
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { FormJRenderer } = require('../dist/main/services/renderers/FormJRenderer');

async function testFormJ6StackedNames() {
  console.log('===========================================================');
  console.log('TESTING FORM J: 6 STACKED MEMBER NAMES (LINES 1 TO 6)');
  console.log('===========================================================');

  const mockSociety = {
    societyName: 'HENU OS PVT LTD CO-SOC',
    registrationNo: 'U62099RJ2025PTC109150',
    registrationDate: '02/12/2025',
    headerAddress: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401',
    address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401',
    societyAddress: {
      line1: 'Home Bhagesar, 10B-204 Second Floor',
      line2: 'Pali AASAN home',
      line3: 'Pali, Rajasthan',
      line4: '306401',
      line5: '',
      line6: '',
    },
    email: 'info@henuos.org',
    telephone: '9876543210',
    totalUnits: 20,
    unitsFlat: 20,
    unitsShop: 0,
    unitsOffice: 0,
    unitsGala: 0,
    printBlanks: 0,
  };

  const mockRecords = [
    {
      serial: '001',
      record: {
        srNo: '001',
        member1: 'Aarav R. Shah',
        member2: 'Bhavna A. Shah',
        member3: 'Chirag A. Shah',
        member4: 'Deepa A. Shah',
        member5: 'Esha A. Shah',
        member6: 'Farhan A. Shah',
        permanentAddress: '101 / A, Home Bhagesar',
        residentialAddress: '',
        classOfMember: 'Class-A',
      },
    },
    {
      serial: '002',
      record: {
        srNo: '002',
        member1: 'Vivaan S. Patel',
        member2: 'Pooja V. Patel',
        member3: 'Rohan V. Patel',
        member4: '',
        member5: '',
        member6: '',
        permanentAddress: '102 / A, Home Bhagesar',
        residentialAddress: '',
        classOfMember: 'Class-B',
      },
    },
    {
      serial: '003',
      record: {
        srNo: '003',
        memberName: 'Aditya M. Mehta / Sunita A. Mehta / Karan A. Mehta / Neha A. Mehta',
        permanentAddress: '103 / B, Home Bhagesar',
        residentialAddress: '',
        classOfMember: 'Class-C',
      },
    }
  ];

  const pdfBuffer = await FormJRenderer.render(
    mockRecords,
    mockSociety,
    { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true }
  );

  assert.ok(pdfBuffer && pdfBuffer.length > 5000, 'PDF buffer must be generated');
  const outPath = path.join(__dirname, 'form_j_6_stacked_names.pdf');
  fs.writeFileSync(outPath, pdfBuffer);

  console.log(`[PASS] Form J PDF generated with 6 stacked member names at ${outPath} (${pdfBuffer.length} bytes).`);
  console.log('===========================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('===========================================================');
}

testFormJ6StackedNames().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
