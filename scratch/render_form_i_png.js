const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
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

async function renderPdfPng() {
  const res = await PdfEngine.generate({
    formId: 'FORM_I',
    fromSerial: '001',
    toSerial: '001',
    workbook: mockWorkbook,
  });

  const pdfBuffer = res.files[0].buffer;
  const base64Pdf = pdfBuffer.toString('base64');

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
    </head>
    <body style="margin:0; background:#f0f0f0; display:flex; justify-content:center;">
      <canvas id="pdf-canvas"></canvas>
      <script>
        const pdfData = atob("${base64Pdf}");
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        loadingTask.promise.then(pdf => {
          pdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderContext = { canvasContext: context, viewport: viewport };
            page.render(renderContext);
          });
        });
      </script>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));

  const artifactPath = path.join('C:', 'Users', 'henus', '.gemini', 'antigravity-ide', 'brain', 'd25b79bb-6cf7-4723-acac-bf7e7a277907', `form_i_balances_fixed_${Date.now()}.png`);
  await page.screenshot({ path: artifactPath, fullPage: true });

  console.log('SCREENSHOT SAVED TO:', artifactPath);
  await browser.close();
}

renderPdfPng().catch(err => console.error(err));
