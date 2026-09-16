// ============================================================
// Test Suite: Bank Lien Mark Full-Page Layout & Remarks
// ============================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LienMarkRenderer } = require('../dist/main/services/renderers/LienMarkRenderer');

async function testLienMarkFullPage() {
  console.log('===========================================================');
  console.log('TESTING BANK LIEN MARK: FULL-PAGE LAYOUT & LOAN REMARKS');
  console.log('===========================================================');

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
        srNo: '001',
        member1: 'Aarav01',
        member2: 'Vikram01',
        member3: 'Rajendra01',
        member4: 'Kumar01',
        member5: 'Singh01',
        member6: 'Mehta01',
        wingNo: 'A',
        flatNo: '102',
        area: 'Area-901 Sq.Ft.',
        classOfMember: 'Active Member',
        remarks: 'Member Master Remark 01',
        loan1BankName: 'HENU Bank A',
        loan1BankAddress: 'Bank Branch 01, Kidwai Nagar Residency Co-op. Housing Society Ltd. C.S. NO.364 (Pt), 365 (Pt), 366 (Pt), DIVISTION DADR, NAIGAON, R.K. KIDWAI MARG, WADALA, MUMBAI - 400031',
        loan1Amount: '525000',
        loan1Period: '121 Months',
        loan1MCDate: '15/01/2021',
        loan1ResolutionNo: 'RES-001',
        loan1NOCDate: '20/01/2021',
        loan1CancelDate: '25/01/2026',
        loan1Remark: 'Loan 1 verified and sanctioned',
        loan2BankName: 'State Bank of India',
        loan2BankAddress: 'Nariman Point Branch, Mumbai',
        loan2Amount: '200000',
        loan2Period: '60 Months',
        loan2MCDate: '10/06/2022',
        loan2ResolutionNo: 'RES-045',
        loan2NOCDate: '15/06/2022',
        loan2CancelDate: '',
        loan2Remark: 'Loan top-up approved',
        loan3BankName: '',
        loan3BankAddress: '',
        loan3Amount: '',
        loan3Period: '',
        loan3MCDate: '',
        loan3ResolutionNo: '',
        loan3NOCDate: '',
        loan3CancelDate: '',
        loan3Remark: '',
        loan4BankName: '',
        loan4BankAddress: '',
        loan4Amount: '',
        loan4Period: '',
        loan4MCDate: '',
        loan4ResolutionNo: '',
        loan4NOCDate: '',
        loan4CancelDate: '',
        loan4Remark: '',
      },
    }
  ];

  const pdfBuffer = await LienMarkRenderer.render(
    records,
    mockSociety,
    { orientationOverride: 'Portrait', renderMode: 'Color', gridOn: true }
  );

  console.log('Lien mark PDF Buffer size:', pdfBuffer?.length);
  assert.ok(pdfBuffer && pdfBuffer.length > 1000, 'PDF buffer must be generated');
  const outPath = path.join(__dirname, 'lien_mark_full_page.pdf');
  fs.writeFileSync(outPath, pdfBuffer);

  console.log(`[PASS] Bank Lien Mark PDF generated successfully at ${outPath} (${pdfBuffer.length} bytes).`);
  console.log('===========================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('===========================================================');
}

testLienMarkFullPage().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
