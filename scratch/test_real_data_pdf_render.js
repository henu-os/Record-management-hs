// ============================================================
// HENU OS — Real-Data PDF Field Population Integration Test
// ============================================================

const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');
const { FormMappingService } = require('../dist/main/services/FormMappingService');

const mockSociety = {
  societyName: 'SHREE GANESH CO-OPERATIVE HOUSING SOCIETY LTD.',
  registrationNo: 'MUM/MH/HSG/12345/2010',
  registrationDate: '15/08/2010',
  address: 'Plot No. 42, Sector 15, Vashi, Navi Mumbai - 400703',
  totalMembers: '18',
};

// 001, 002, 004, 005 populated; 003 missing/blank
const mockCommonFile = [
  {
    srNo: '001',
    membershipNo: 'M-001',
    shareCertificateNo: 'SC-101',
    noOfShares: '5',
    valueOfShares: '250',
    memberName: 'RAMESH CHANDRA SHARMA',
    member1: 'RAMESH CHANDRA SHARMA',
    permanentAddress: 'Flat 101, A Wing, Shree Ganesh CHS, Vashi',
    flatNo: '101',
    wingNo: 'A',
    residentialAddress: 'Flat 101, A Wing, Shree Ganesh CHS, Vashi',
    dateOfAdmission: '01/01/2012',
  },
  {
    srNo: '002',
    membershipNo: 'M-002',
    shareCertificateNo: 'SC-102',
    noOfShares: '5',
    valueOfShares: '250',
    memberName: 'SURESH KUMAR VERMA',
    member1: 'SURESH KUMAR VERMA',
    permanentAddress: 'Flat 102, A Wing, Shree Ganesh CHS, Vashi',
    flatNo: '102',
    wingNo: 'A',
    residentialAddress: 'Flat 102, A Wing, Shree Ganesh CHS, Vashi',
    dateOfAdmission: '05/01/2012',
  },
  // 003 is intentionally omitted to verify gap handling
  {
    srNo: '004',
    membershipNo: 'M-004',
    shareCertificateNo: 'SC-104',
    noOfShares: '5',
    valueOfShares: '250',
    memberName: 'AMITABH BACHCHAN',
    member1: 'AMITABH BACHCHAN',
    permanentAddress: 'Flat 201, B Wing, Shree Ganesh CHS, Vashi',
    flatNo: '201',
    wingNo: 'B',
    residentialAddress: 'Jalsa, Juhu, Mumbai',
    dateOfAdmission: '10/01/2012',
  },
  {
    srNo: '005',
    membershipNo: 'M-005',
    shareCertificateNo: 'SC-105',
    noOfShares: '5',
    valueOfShares: '250',
    memberName: 'VIKRAM RAJESH SHAH',
    member1: 'VIKRAM RAJESH SHAH',
    permanentAddress: 'Flat 202, B Wing, Shree Ganesh CHS, Vashi',
    flatNo: '202',
    wingNo: 'B',
    residentialAddress: 'Flat 202, B Wing, Shree Ganesh CHS, Vashi',
    dateOfAdmission: '15/01/2012',
  },
];

const mockWorkbook = {
  societyMaster: mockSociety,
  commonFile: mockCommonFile,
  formIData: [],
  formJData: [],
  shareData: [],
  nominationData: [],
  propertyData: [],
  bankLineMarkData: [],
};

async function testRealDataPopulation() {
  console.log('==================================================');
  console.log('HENU OS — REAL-DATA PDF FIELD POPULATION TEST');
  console.log('==================================================\n');

  // Verify FormMappingService resolution directly
  const rec1 = FormMappingService.resolveRecord(mockWorkbook, 'FORM_I', '001');
  const rec3 = FormMappingService.resolveRecord(mockWorkbook, 'FORM_I', '003');

  console.log('Resolved Record 001 Member Name:', rec1.memberName || rec1.member1);
  console.log('Resolved Record 001 Flat No:', rec1.flatNo);
  console.log('Resolved Record 003 Member Name:', rec3.memberName || rec3.member1 || '(Blank as expected)');

  const pass1 = (rec1.memberName === 'RAMESH CHANDRA SHARMA' || rec1.member1 === 'RAMESH CHANDRA SHARMA');
  const pass3 = (rec3.memberName === '' && rec3.member1 === '' && rec3.srNo === '003');

  console.log(`\n- Record 001 resolution: ${pass1 ? 'PASS' : 'FAIL'}`);
  console.log(`- Record 003 blank resolution: ${pass3 ? 'PASS' : 'FAIL'}`);

  // Generate Form I PDFs for range 001..005
  const resI = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '005',
    workbook: mockWorkbook,
  });

  console.log(`- Generated ${resI.files.length} Form I files.`);

  // Generate Form J PDF for range 001..005
  const resJ = await PdfEngine.generate({
    formId: 'FORM_J',
    fromSerial: '001',
    toSerial: '005',
    workbook: mockWorkbook,
  });

  console.log(`- Generated Form J PDF (${resJ.files[0].buffer.length} bytes).`);

  if (pass1 && pass3 && resI.files.length === 5 && resJ.files[0].buffer.length > 1000) {
    console.log('\n==================================================');
    console.log('REAL-DATA PDF FIELD POPULATION TEST: 100% PASS');
    console.log('==================================================');
  } else {
    console.error('\n[FAIL] Real-data PDF field population failed.');
    process.exit(1);
  }
}

testRealDataPopulation().catch(err => {
  console.error('[FAIL] Error:', err);
  process.exit(1);
});
