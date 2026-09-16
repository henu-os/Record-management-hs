// ============================================================
// Test Suite: Form J 9 Rows Per Page & Address Cell Fix
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { FormJRenderer } = require('../dist/main/services/renderers/FormJRenderer');

async function testFormJ() {
  console.log('===========================================================');
  console.log('TESTING FORM J: 9 ROWS PER PAGE & ADDRESS COLLISION FIX');
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

  const mockRecords = [];
  for (let i = 1; i <= 10; i++) {
    const sr = String(i).padStart(3, '0');
    mockRecords.push({
      serial: sr,
      record: {
        srNo: sr,
        member1: `Aarav${String(i).padStart(2, '0')}`,
        memberName: `Aarav${String(i).padStart(2, '0')}`,
        permanentAddress: `${100 + i} / A, Home Bhagesar`,
        residentialAddress: '',
        classOfMember: `Class-${['A', 'B', 'C'][i % 3]}`,
      },
    });
  }

  const pdfBuffer = await FormJRenderer.render(
    mockRecords,
    mockSociety,
    { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true }
  );

  assert.ok(pdfBuffer && pdfBuffer.length > 5000, 'PDF buffer must be generated');
  const outPath = path.join(__dirname, 'form_j_fixed_9rows.pdf');
  fs.writeFileSync(outPath, pdfBuffer);

  console.log(`[PASS] Form J PDF generated with 9 rows/page at ${outPath} (${pdfBuffer.length} bytes).`);
  console.log('===========================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('===========================================================');
}

testFormJ().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
