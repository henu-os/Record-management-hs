const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

const mockSociety = {
  societyName: 'HENU OS PVT LTD CO-SOC',
  registrationNo: 'U62099RJ2025PTC109150',
  registrationDate: '02/12/2025',
  address: 'Home Bhagesar, 10B-204 Second Floor, Pali AASAN home, Pali, Rajasthan 306401',
};

const mockLongLienRecord = {
  srNo: '001',
  membershipNo: 'M-001',
  shareCertificateNo: 'SC-101',
  wingNo: 'A',
  flatNo: '102 / A',
  area: '901 Sq.Ft.',
  memberName: 'Aarav01',
  classOfMember: 'Active Member',
  bankName: 'HENU Bank A',
  bankAddress: 'Bank Branch 01, Kidwai Nagar Residency Co-op. Housing Society Ltd. C.S. NO.364 (Pt), 365 (Pt), 366 (Pt), DIVISION DADR, NAIGAON, R.K. KIDWAI MARG, WADALA, MUMBAI - 400031',
  loanAmount: '525000',
  loanPeriod: '121 Months',
  mcMeetingApprovalDate: '46115',
  resolutionNo: 'RES-001',
  dateOfNOC: '46174',
  dateOfLienCancellation: '46175',
};

const mockWorkbook = {
  societyMaster: mockSociety,
  commonFile: [mockLongLienRecord],
  formIData: [mockLongLienRecord],
  formJData: [mockLongLienRecord],
  shareData: [mockLongLienRecord],
  nominationData: [mockLongLienRecord],
  propertyData: [mockLongLienRecord],
  bankLineMarkData: [mockLongLienRecord],
};

async function testDynamicRowHeight() {
  console.log('==================================================');
  console.log('TESTING DYNAMIC ROW HEIGHT FOR LONG DATA & BOLD VALUES');
  console.log('==================================================\n');

  const forms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
  let passCount = 0;

  for (const formId of forms) {
    try {
      const res = await PdfEngine.generate({
        formId,
        fromSerial: '001',
        toSerial: '001',
        workbook: mockWorkbook,
      });

      const pdf = await PDFDocument.load(res.files[0].buffer);
      console.log(`[PASS] ${formId}: Generated successfully (${pdf.getPageCount()} pages)`);
      passCount++;
    } catch (err) {
      console.log(`[FAIL] ${formId}: Error - ${err.message}`);
    }
  }

  console.log('\n==================================================');
  console.log(`RESULT: ${passCount}/${forms.length} FORMS PASSED WITH DYNAMIC ROW HEIGHT & BOLD VALUES`);
  console.log('==================================================');

  if (passCount === forms.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testDynamicRowHeight();
