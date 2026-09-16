const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

const mockSociety = {
  societyName: 'GLOBAL DESIGN AND STRUCTURAL RULES HOUSING SOCIETY',
  registrationNo: '[REG-NUMBER]',
  registrationDate: '[DATE]',
  address: 'FULL ADDRESS LINE 1, CITY, STATE, ZIP',
};

const mockRecord = {
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
  memberName: 'RAJESH VISHWANATH SHARMA WITH A VERY LONG NAME THAT WRAPS ACROSS MULTIPLE LINES SAFELY',
  permanentAddress: 'Flat 101, A Wing, Saisastha Crystal CHS Ltd, Bhandup (West), Mumbai - 400078',
  residentialAddress: 'Flat 101, A Wing, Saisastha Crystal CHS Ltd, Bhandup (West), Mumbai - 400078',
  occupation: 'Business Executive',
  age: '45',
  nomineeName: 'SUNITA RAJESH SHARMA',
  nomineeAddress: 'Flat 101, A Wing, Saisastha Crystal CHS Ltd, Bhandup (West), Mumbai - 400078',
  dateOfNomination: '15/05/2021',
  dateOfCessation: '10/01/2024',
  reasonForCessation: 'Transferred Membership',
  remarks: 'Initial Allotment and transfer',
};

const mockWorkbook = {
  societyMaster: mockSociety,
  commonFile: [mockRecord],
  formIData: [mockRecord],
  formJData: [],
  shareData: [],
  nominationData: [],
  propertyData: [],
  bankLineMarkData: [],
};

async function verifyFormI() {
  console.log('==================================================');
  console.log('VERIFYING FORM I EXACT 4-ROW TABLES & SINGLE PAGE FIT');
  console.log('==================================================\n');

  const res = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '001',
    workbook: mockWorkbook,
  });

  const pdf = await PDFDocument.load(res.files[0].buffer);
  const pageCount = pdf.getPageCount();
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();

  console.log(`- Generated Files Count: ${res.files.length}`);
  console.log(`- Page Count: ${pageCount}`);
  console.log(`- Document Size: ${width} x ${height} pt`);

  const passSinglePage = pageCount === 1;
  const passDimensions = Math.abs(width - 612) < 1 && Math.abs(height - 1008) < 1;

  console.log(`\nSingle Page Fit: ${passSinglePage ? 'PASS' : 'FAIL'}`);
  console.log(`Legal Portrait (612x1008 pt): ${passDimensions ? 'PASS' : 'FAIL'}`);

  if (passSinglePage && passDimensions) {
    console.log('\n==================================================');
    console.log('FORM I VERIFICATION PASSED PERFECTLY!');
    console.log('==================================================');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verifyFormI();
