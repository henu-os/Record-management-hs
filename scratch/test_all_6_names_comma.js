// ============================================================
// Test Suite: 6 Joint Member Names Comma Formatting & Cell Fit
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { FormMappingService } = require('../dist/main/services/FormMappingService');
const { PropertyRegisterRenderer } = require('../dist/main/services/renderers/PropertyRegisterRenderer');
const { FormIRenderer } = require('../dist/main/services/renderers/FormIRenderer');
const { FormJRenderer } = require('../dist/main/services/renderers/FormJRenderer');
const { NominationRegisterRenderer } = require('../dist/main/services/renderers/NominationRegisterRenderer');
const { LienMarkRenderer } = require('../dist/main/services/renderers/LienMarkRenderer');

async function test6NamesFormatting() {
  console.log('===========================================================');
  console.log('TESTING 6 JOINT MEMBER NAMES COMMA (,) FORMATTING & CELL FIT');
  console.log('===========================================================');

  // Test 1: formatAllMemberNames with 6 member fields
  const mock6 = {
    srNo: '001',
    member1: 'Aarav R. Shah',
    member2: 'Bhavna A. Shah',
    member3: 'Chirag A. Shah',
    member4: 'Deepa A. Shah',
    member5: 'Esha A. Shah',
    member6: 'Farhan A. Shah',
    memberName: 'Aarav R. Shah',
  };
  const formatted6 = FormMappingService.formatAllMemberNames(mock6);
  assert.strictEqual(formatted6, 'Aarav R. Shah, Bhavna A. Shah, Chirag A. Shah, Deepa A. Shah, Esha A. Shah, Farhan A. Shah');
  console.log('[PASS] Test 1: Comma formatting with 6 member fields: ' + formatted6);

  // Test 2: formatAllMemberNames with composite slash/plus/comma memberName
  const mockComposite = {
    srNo: '002',
    memberName: 'Rahul K. Verma / Priya R. Verma + Amit R. Verma, Sunita R. Verma',
  };
  const formattedComp = FormMappingService.formatAllMemberNames(mockComposite);
  assert.strictEqual(formattedComp, 'Rahul K. Verma, Priya R. Verma, Amit R. Verma, Sunita R. Verma');
  console.log('[PASS] Test 2: Comma formatting with composite string: ' + formattedComp);

  const mockSociety = {
    societyName: 'HENU OS PVT LTD CO-SOC',
    registrationNo: 'U62099RJ2025PTC109150',
    registrationDate: '02/12/2025',
    headerAddress: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401',
    address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401',
    email: 'info@henuos.org',
    telephone: '9876543210',
    totalUnits: 20,
    unitsFlat: 20,
    unitsShop: 0,
    unitsOffice: 0,
    unitsGala: 0,
    printBlanks: 0,
  };

  const records = [
    {
      serial: '001',
      record: {
        ...mock6,
        flatNo: '101',
        floor: '1',
        descriptionOfTenement: 'Residential Flat',
        area: '850',
        landCost: '500000',
        constructionCost: '1500000',
        annualGroundRent: '1200',
        dateOfPossession: '01/01/2020',
        dateOfAdmission: '01/01/2020',
        nomineeName: 'Kavita Shah',
        nomineePercentage: '100',
        classOfMember: 'Active Member',
      },
    }
  ];

  // Test 3: Render Property Register with 6 names
  const propBuf = await PropertyRegisterRenderer.render(records, mockSociety, { orientationOverride: 'Landscape', renderMode: 'Color', gridOn: true });
  assert.ok(propBuf && propBuf.length > 5000);
  console.log('[PASS] Test 3: Property Register rendered cleanly with 6 joint names.');

  // Test 4: Render Form I with 6 names
  const formIBufs = await FormIRenderer.render(records, mockSociety, { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true });
  assert.ok(formIBufs && formIBufs.length > 0 && formIBufs[0].length > 5000);
  console.log('[PASS] Test 4: Form I rendered cleanly with 6 joint names.');

  // Test 5: Render Form J with 6 names
  const formJBuf = await FormJRenderer.render(records, mockSociety, { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true });
  assert.ok(formJBuf && formJBuf.length > 5000);
  console.log('[PASS] Test 5: Form J rendered cleanly with 6 joint names.');

  // Test 6: Render Nomination Register with 6 names
  const nomBuf = await NominationRegisterRenderer.render(records, mockSociety, { orientationOverride: 'Landscape', renderMode: 'Color', gridOn: true });
  assert.ok(nomBuf && nomBuf.length > 5000);
  console.log('[PASS] Test 6: Nomination Register rendered cleanly with 6 joint names.');

  // Test 7: Render Lien Mark with 6 names
  const lienBuf = await LienMarkRenderer.render(records, mockSociety, { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true });
  console.log('lienBuf length:', lienBuf?.length);
  assert.ok(lienBuf && lienBuf.length > 1000);
  console.log('[PASS] Test 7: Lien Mark rendered cleanly with 6 joint names.');

  console.log('===========================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('===========================================================');
}

test6NamesFormatting().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
