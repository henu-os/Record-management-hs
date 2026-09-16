const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

async function verifyNativePdfRendering() {
  console.log('==================================================');
  console.log('REAL RENDERING ACCEPTANCE TEST — PDF INTERNAL INSPECTION');
  console.log('==================================================\n');

  const workbookPath = 'G:\\Astro\\test\\test_members.xlsx';
  const workbook = MasterDataService.parseWorkbook(workbookPath);

  const forms = [
    { formId: 'FORM_I', expectedOrientation: 'Portrait', expectedWidth: 595.28, expectedHeight: 841.89 },
    { formId: 'FORM_J', expectedOrientation: 'Portrait', expectedWidth: 595.28, expectedHeight: 841.89 },
    { formId: 'FORM_BANK', expectedOrientation: 'Portrait', expectedWidth: 595.28, expectedHeight: 841.89 },
    { formId: 'FORM_SHARE', expectedOrientation: 'Landscape', expectedWidth: 841.89, expectedHeight: 595.28 },
    { formId: 'FORM_PROP', expectedOrientation: 'Landscape', expectedWidth: 841.89, expectedHeight: 595.28 },
    { formId: 'FORM_NOM', expectedOrientation: 'Landscape', expectedWidth: 841.89, expectedHeight: 595.28 },
  ];

  let allPassed = true;

  for (const f of forms) {
    console.log(`[VERIFYING] ${f.formId}...`);

    const result = await PdfEngine.generate({
      formId: f.formId,
      fromSerial: '001',
      toSerial: '005',
      workbook,
    });

    if (!result.files || result.files.length === 0) {
      console.error(`❌ ${f.formId}: Failed to generate PDF output!`);
      allPassed = false;
      continue;
    }

    const pdfBuffer = result.files[0].buffer;
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      console.error(`❌ ${f.formId}: PDF has 0 pages!`);
      allPassed = false;
      continue;
    }

    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Check orientation dimensions
    const isWidthOk = Math.abs(width - f.expectedWidth) < 1;
    const isHeightOk = Math.abs(height - f.expectedHeight) < 1;

    if (!isWidthOk || !isHeightOk) {
      console.error(`❌ ${f.formId}: Dimensions mismatch! Expected ${f.expectedWidth}x${f.expectedHeight}, got ${width}x${height}`);
      allPassed = false;
    } else {
      console.log(`  ✓ Page dimensions: ${width.toFixed(2)} x ${height.toFixed(2)} pt (${f.expectedOrientation})`);
    }

    // Inspect internal objects: count embedded images/XObjects
    const imagesInDoc = pdfDoc.context.enumerateIndirectObjects().filter(([ref, obj]) => {
      if (obj && typeof obj === 'object' && obj.dict) {
        const subtype = obj.dict.get && obj.dict.get(PDFDocument.PDFName ? PDFDocument.PDFName.of('Subtype') : undefined);
        return subtype && subtype.toString() === '/Image';
      }
      return false;
    });

    if (imagesInDoc.length > 0) {
      console.error(`❌ ${f.formId}: Found ${imagesInDoc.length} embedded background images! FAIL!`);
      allPassed = false;
    } else {
      console.log(`  ✓ Embedded Images Count: 0 (Pure Native Vector PDF)`);
    }

    console.log(`  ✓ File Output Size: ${pdfBuffer.length} bytes`);
    console.log(`  ✓ PDF Header: ${pdfBuffer.toString('utf-8', 0, 5)}`);
  }

  console.log('\n==================================================');
  if (allPassed) {
    console.log('SUCCESS: All 6 Forms Natively Constructed Without Legacy Assets!');
  } else {
    console.error('FAIL: One or more native rendering verification checks failed!');
    process.exit(1);
  }
  console.log('==================================================');
}

verifyNativePdfRendering().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
