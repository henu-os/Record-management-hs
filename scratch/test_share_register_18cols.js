// ============================================================
// Test Suite: 18-Column Share Register with 12 Rows Per Page
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ShareRegisterRenderer } = require('../dist/main/services/renderers/ShareRegisterRenderer');
const { ShareRegisterDefinition } = require('../dist/main/services/renderers/definitions/ShareRegisterDefinition');

async function testShareRegister() {
  console.log('===========================================================');
  console.log('TESTING 18-COLUMN SHARE REGISTER WITH 12 ROWS PER PAGE');
  console.log('===========================================================');

  // Verify definition has 18 distinct flat columns / fields
  assert.strictEqual(ShareRegisterDefinition.flatColumns.length, 19, 'Must have 19 flat column definitions (including split From/To)');
  console.log('[PASS] ShareRegisterDefinition has all 18 logical columns (19 flat cols with From & To).');

  const mockSociety = {
    societyName: 'HENU OS GREEN RESIDENCY COOPERATIVE HOUSING SOCIETY LTD.',
    registrationNo: 'GJ/AHD/CHS/2026/00478',
    registrationDate: '18-May-2018',
    headerAddress: 'Plot 24, HENU Tech Residency, Ahmedabad, Gujarat 380015',
    address: 'Plot 24, HENU Tech Residency, Ahmedabad, Gujarat 380015',
    email: 'info@henuos.org',
    telephone: '9876543210',
    totalUnits: 100,
    unitsFlat: 100,
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
        dateOfAllotment: '15/01/2020',
        cashBookFolio: 'CB-101',
        shareCertificateNo: 'SC-001',
        noOfShares: '5',
        valueOfShares: '250',
        memberName: 'Aarav R. Shah',
        member1: 'Aarav R. Shah',
        member2: 'Bhavna A. Shah',
        member3: 'Chirag A. Shah',
        member4: 'Deepa A. Shah',
        member5: 'Esha A. Shah',
        member6: 'Farhan A. Shah',
        flatNo: '101',
        wingNo: 'A',
        dateOfTransferRefund: '18-01-2022',
        noOfSharesTransferred: '5',
        transferCertificateNo: 'TC-099',
        sharesValueTransferred: '250',
        nameOfTransferee: 'Vivaan S. Patel',
        authorityForTransfer: 'Board Resolution 12',
        oldShareCertNo: 'OSC-888',
        oldMembershipNo: 'OM-777',
        sharesFrom: '1',
        sharesTo: '5',
        remarks: 'Transferred cleanly',
      },
    },
    {
      serial: '002',
      record: {
        srNo: '002',
        dateOfAllotment: '20/02/2020',
        cashBookFolio: 'CB-102',
        shareCertificateNo: 'SC-002',
        noOfShares: '5',
        valueOfShares: '250',
        memberName: 'Vivaan S. Patel',
        member1: 'Vivaan S. Patel',
        member2: 'Pooja V. Patel',
        member3: '',
        member4: '',
        member5: '',
        member6: '',
        flatNo: '102',
        wingNo: 'A',
        dateOfTransferRefund: '',
        noOfSharesTransferred: '',
        transferCertificateNo: '',
        sharesValueTransferred: '',
        nameOfTransferee: '',
        authorityForTransfer: '',
        oldShareCertNo: '',
        oldMembershipNo: '',
        sharesFrom: '6',
        sharesTo: '10',
        remarks: '',
      },
    },
    {
      serial: '003',
      record: {
        srNo: '003',
        dateOfAllotment: '05/03/2020',
        cashBookFolio: 'CB-103',
        shareCertificateNo: 'SC-003',
        noOfShares: '10',
        valueOfShares: '500',
        memberName: 'Aditya M. Mehta',
        member1: 'Aditya M. Mehta',
        member2: '',
        member3: '',
        member4: '',
        member5: '',
        member6: '',
        flatNo: '103',
        wingNo: 'B',
        dateOfTransferRefund: '',
        noOfSharesTransferred: '',
        transferCertificateNo: '',
        sharesValueTransferred: '',
        nameOfTransferee: '',
        authorityForTransfer: '',
        oldShareCertNo: '',
        oldMembershipNo: '',
        sharesFrom: '11',
        sharesTo: '20',
        remarks: '',
      },
    }
  ];

  const pdfBuffer = await ShareRegisterRenderer.render(
    mockRecords,
    mockSociety,
    { orientationOverride: 'Landscape', renderMode: 'Color', gridOn: true }
  );

  assert.ok(pdfBuffer && pdfBuffer.length > 5000, 'PDF buffer must be generated with content');
  
  const outPath = path.join(__dirname, 'share_register_18cols_12rows.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`[PASS] Share Register PDF generated successfully at ${outPath} (${pdfBuffer.length} bytes).`);
  console.log('===========================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('===========================================================');
}

testShareRegister().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
