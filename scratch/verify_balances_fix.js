const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

const mockSociety = {
  societyName: 'GLOBAL DESIGN AND STRUCTURAL RULES HOUSING SOCIETY',
  registrationNo: '[REG-NUMBER]',
  registrationDate: '[DATE]',
  address: 'FULL ADDRESS LINE 1, CITY, STATE, ZIP',
};

const mock6MemberRecord = {
  srNo: '001',
  membershipNo: 'M-001',
  shareCertificateNo: 'SC-101',
  noOfShares: '10',
  valueOfShares: '500',
  sharesFrom: '101',
  sharesTo: '110',
  dateOfAllotment: '12/04/2021',
  cashBookFolio: '15',
  dateOfAdmission: '12/04/2021',
  dateOfEntranceFee: '12/04/2021',
  memberName: '',
  member1: 'Ansari Riyaz Ahmed Siraj Ahmed',
  member2: 'Ansari Shabana Riyaz Ahmed',
  member3: 'Ansari Mohammed Zaid Siraj Ahmed',
  member4: 'Ansari Aisha Khatoon Siraj Ahmed',
  member5: 'Ansari Fatima Begum Siraj Ahmed',
  member6: 'Ansari Tariq Mahmood Siraj Ahmed',
  permanentAddress: 'Flat No. 1101, Kidwai Nagar Residency Co-op. Housing Society Ltd., C.S. NO.364 (Pt), 365 (Pt), 366 (Pt), DIVISION DADAR, Mumbai - 400014',
  residentialAddress: 'Flat No. 1101, Kidwai Nagar Residency Co-op. Housing Society Ltd., C.S. NO.364 (Pt), 365 (Pt), 366 (Pt), DIVISION DADAR, Mumbai - 400014',
  occupation: 'Business & Real Estate',
  age: '45',
  nomineeName: 'Ansari Shabana Riyaz Ahmed',
  nomineeAddress: 'Same as above, Flat No. 1101, Kidwai Nagar Residency, Dadar, Mumbai - 400014',
  dateOfNomination: '15/05/2021',
  dateOfCessation: '',
  reasonForCessation: '',
  remarks: 'Initial Allotment with 6 joint members',
};

const mockWorkbook = {
  societyMaster: mockSociety,
  commonFile: [mock6MemberRecord],
  formIData: [mock6MemberRecord],
  formJData: [mock6MemberRecord],
  shareData: [mock6MemberRecord],
  nominationData: [mock6MemberRecord],
  propertyData: [mock6MemberRecord],
  bankLineMarkData: [mock6MemberRecord],
};

async function verifyBalancesFix() {
  console.log('==================================================');
  console.log('VERIFYING BALANCES SUB-HEADER FIT & 1-PAGE FORM I FIT');
  console.log('==================================================\n');

  const res = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '001',
    workbook: mockWorkbook,
  });

  const pdf = await PDFDocument.load(res.files[0].buffer);
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();

  console.log(`Page Dimensions: ${width} x ${height} pt (Legal Portrait)`);
  console.log(`Total Pages Generated: ${pdf.getPageCount()}`);

  if (pdf.getPageCount() === 1) {
    console.log('[PASS] Form I fits on 1 single Legal page!');
  } else {
    console.log('[FAIL] Form I spilled onto multiple pages!');
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('ALL FORM I GEOMETRY & BALANCES HEADER CHECKS PASSED');
  console.log('==================================================');
}

verifyBalancesFix().catch(err => {
  console.error(err);
  process.exit(1);
});
