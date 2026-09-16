const path = require('path');
const fs = require('fs');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

async function testUserWorkbook() {
  const fileCandidates = [
    path.join(__dirname, '..', 'test', 'test_members.xlsx'),
    path.join(process.env.USERPROFILE || 'C:\\Users\\henus', 'Downloads', 'HENU_OS_Master_Data_Template.xlsx'),
  ];

  let targetFile = fileCandidates.find(f => fs.existsSync(f));
  
  if (!targetFile) {
    console.log('No test workbook found.');
    return;
  }

  console.log('Testing Master Data Workbook:', targetFile);
  const workbook = await MasterDataService.parseWorkbook(targetFile);
  
  console.log('Parse status:');
  console.log('  Society:', workbook.societyMaster?.societyName || 'N/A');
  console.log('  Common records:', workbook.commonFile.length);
  console.log('  Form I records:', workbook.formIData.length);
  console.log('  Form J records:', workbook.formJData.length);
  console.log('  Share records:', workbook.shareData.length);

  // Test generating range 001 to 027 (27 requested serial positions)
  const forms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
  const outDir = path.join(__dirname, 'test_members_pdfs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const formId of forms) {
    const result = await PdfEngine.generate({
      formId,
      fromSerial: '001',
      toSerial: '027',
      workbook: workbook,
    });
    console.log(`\nForm ${formId}: Generated ${result.files.length} file(s) for 001-027 range.`);
    if (formId === 'FORM_I') {
      if (result.files.length !== 27) {
        throw new Error(`Expected 27 files for FORM_I, got ${result.files.length}`);
      }
    } else {
      if (result.files.length !== 1) {
        throw new Error(`Expected 1 file for ${formId}, got ${result.files.length}`);
      }
    }
    for (const f of result.files.slice(0, 3)) {
      const outPath = path.join(outDir, f.filename);
      fs.writeFileSync(outPath, f.buffer);
      console.log(`  Wrote ${f.filename} (${f.buffer.length} bytes)`);
    }
  }

  console.log('\n==================================================');
  console.log('SUCCESS: All 6 forms natively rendered for 001-027 range (27 records verified)!');
  console.log('==================================================');
}

testUserWorkbook().catch(err => {
  console.error('Error testing user workbook:', err);
  process.exit(1);
});
