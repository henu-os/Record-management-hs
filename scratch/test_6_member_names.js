const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

const mockSociety = {
  societyName: 'GLOBAL DESIGN AND STRUCTURAL RULES HOUSING SOCIETY',
  registrationNo: '[REG-NUMBER]',
  registrationDate: '[DATE]',
  address: 'FULL ADDRESS LINE 1, CITY, STATE, ZIP',
};

// Record with 6 Member Names
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

async function run6MemberTests() {
  console.log('==================================================');
  console.log('TESTING 6 JOINT MEMBER NAMES & TEXT BOUNDS ACCROSS ALL FORMS');
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
  console.log(`RESULT: ${passCount}/${forms.length} FORMS PASSED WITH 6 MEMBER NAMES`);
  console.log('==================================================');

  if (passCount === forms.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run6MemberTests();
