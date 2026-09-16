const { PDFDocument } = require('pdf-lib');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

const mockSociety = {
  societyName: 'SAISASTHA CRYSTAL CO-OPERATIVE HOUSING SOCIETY LTD.',
  registrationNo: 'MUM/SRA/HSG/(TC)/13275/2021',
  registrationDate: '21/12/2021',
  address: 'Village Bhandup, Tembipada, Taluka - Kurla, Bhandup (West), Mumbai - 400 078.',
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
  memberName: 'RAJESH VISHWANATH SHARMA',
  member1: 'RAJESH VISHWANATH SHARMA',
  permanentAddress: 'Flat 101, A Wing, Saisastha Crystal CHS Ltd, Bhandup (West), Mumbai - 400078',
  residentialAddress: 'Flat 101, A Wing, Saisastha Crystal CHS Ltd, Bhandup (West), Mumbai - 400078',
  occupation: 'Business',
  age: '45',
  nomineeName: 'SUNITA RAJESH SHARMA',
  nomineeAddress: 'Same as above',
  dateOfNomination: '15/05/2021',
  dateOfCessation: '',
  reasonForCessation: '',
  remarks: 'Initial Allotment',
  flatNo: '101',
  wingNo: 'A',
  classOfMember: 'Active Member',
  area: '650 sq ft',
  loan1BankName: 'State Bank of India',
  loan1BankAddress: 'Bhandup West Branch, Mumbai',
  loan1Amount: '50,00,000',
  loan1Period: '20 Years',
  loan1MCDate: '10/06/2021',
  loan1ResolutionNo: 'RES-2021-04',
  loan1NOCDate: '15/06/2021',
  loan1CancelDate: '',
};

const mockWorkbook = {
  societyMaster: mockSociety,
  commonFile: [mockRecord],
  formIData: [mockRecord],
  formJData: [mockRecord],
  shareData: [mockRecord],
  nominationData: [mockRecord],
  propertyData: [mockRecord],
  bankLineMarkData: [mockRecord],
};

async function testAllForms() {
  console.log('==================================================');
  console.log('VERIFYING ALL 6 LEGAL REGISTER FORM RENDERERS');
  console.log('==================================================\n');

  const forms = [
    { id: 'FORM_I', expectedOrientation: 'Portrait', expectedW: 612, expectedH: 1008 },
    { id: 'FORM_J', expectedOrientation: 'Portrait', expectedW: 612, expectedH: 1008 },
    { id: 'FORM_SHARE', expectedOrientation: 'Landscape', expectedW: 1008, expectedH: 612 },
    { id: 'FORM_NOM', expectedOrientation: 'Landscape', expectedW: 1008, expectedH: 612 },
    { id: 'FORM_PROP', expectedOrientation: 'Landscape', expectedW: 1008, expectedH: 612 },
    { id: 'FORM_BANK', expectedOrientation: 'Portrait', expectedW: 612, expectedH: 1008 },
  ];

  let passCount = 0;

  for (const f of forms) {
    try {
      const res = await PdfEngine.generate({
        formId: f.id,
        fromSerial: '001',
        toSerial: '001',
        workbook: mockWorkbook,
      });

      if (!res.files || res.files.length === 0) {
        console.log(`[FAIL] ${f.id}: No output file produced`);
        continue;
      }

      const pdf = await PDFDocument.load(res.files[0].buffer);
      const page = pdf.getPage(0);
      const { width, height } = page.getSize();

      const widthMatch = Math.abs(width - f.expectedW) < 1;
      const heightMatch = Math.abs(height - f.expectedH) < 1;

      if (widthMatch && heightMatch) {
        console.log(`[PASS] ${f.id}: Geometry ${width}x${height} pt (${f.expectedOrientation} Legal)`);
        passCount++;
      } else {
        console.log(`[FAIL] ${f.id}: Unexpected size ${width}x${height} pt (expected ${f.expectedW}x${f.expectedH})`);
      }
    } catch (err) {
      console.log(`[FAIL] ${f.id}: Exception - ${err.message}`);
    }
  }

  console.log('\n==================================================');
  console.log(`RESULT: ${passCount}/${forms.length} FORMS VERIFIED`);
  console.log('==================================================');

  if (passCount === forms.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testAllForms();
