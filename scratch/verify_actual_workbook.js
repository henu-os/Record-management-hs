// scratch/verify_actual_workbook.js
const path = require('path');
const fs = require('fs');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { MasterDataQueryEngine } = require('../dist/main/services/MasterDataQueryEngine');
const { PdfEngine } = require('../dist/main/services/PdfEngine');
const { PDFDocument } = require('pdf-lib');

async function verifyWorkbook(filePath) {
  console.log(`\n==================================================`);
  console.log(`VERIFYING ACTUAL WORKBOOK: ${path.basename(filePath)}`);
  console.log(`==================================================\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  // 1. Parse workbook
  const wb = MasterDataService.parseWorkbook(filePath);
  console.log(`Society Master:`, wb.societyMaster?.societyName || '(None)', `Reg:`, wb.societyMaster?.registrationNo || '(None)');
  console.log(`Common File records count: ${wb.commonFile.length}`);
  console.log(`Form I records count: ${wb.formIData.length}`);
  console.log(`Form J records count: ${wb.formJData.length}`);
  console.log(`Share Register records count: ${wb.shareData.length}`);
  console.log(`Nomination Register records count: ${wb.nominationData.length}`);
  console.log(`Property Register records count: ${wb.propertyData.length}`);
  console.log(`Bank / Lien Mark records count: ${wb.bankLineMarkData.length}`);

  if (wb.commonFile.length > 0) {
    console.log(`\nSample parsed Common File record [0]:`);
    console.log(`  srNo:`, wb.commonFile[0].srNo);
    console.log(`  memberName:`, wb.commonFile[0].memberName);
    console.log(`  permanentAddress:`, wb.commonFile[0].permanentAddress);
    console.log(`  flatNo:`, wb.commonFile[0].flatNo);
  }

  // 2. Generate PDFs for all 6 forms
  const forms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
  const fromSerial = '001';
  const toSerial = '003';

  for (const formId of forms) {
    console.log(`\n--- Testing Generation for ${formId} (${fromSerial} to ${toSerial}) ---`);
    const output = await PdfEngine.generate({
      formId,
      fromSerial,
      toSerial,
      workbook: wb,
    });

    console.log(`Generated ${output.files.length} file(s).`);
    for (const f of output.files) {
      console.log(`  File: ${f.filename}, Size: ${f.buffer.length} bytes`);
      const pdfDoc = await PDFDocument.load(f.buffer);
      console.log(`  Page count: ${pdfDoc.getPageCount()}`);
      
      // Save PDF to disk for manual visual inspection if needed
      const outDir = path.join(__dirname, 'output_pdfs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, f.filename), f.buffer);
    }
  }

  console.log(`\n==================================================`);
  console.log(`ALL 6 FORMS GENERATED NATIVELY AND SAVED TO scratch/output_pdfs/`);
  console.log(`==================================================\n`);
}

const targetFile = process.argv[2] || path.join(__dirname, '..', 'test', 'test_members.xlsx');
verifyWorkbook(targetFile).catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
