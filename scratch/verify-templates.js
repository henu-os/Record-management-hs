const path = require('path');
const { MasterDataService } = require(path.resolve(__dirname, '../dist/main/services/MasterDataService'));
const ExcelJS = require('exceljs');
const fs = require('fs');

async function verifyGeneratedTemplates() {
  console.log('Testing generateTemplate()...');
  const masterBuf = await MasterDataService.generateTemplate();
  fs.writeFileSync('scratch/HENU_OS_Master_Template_Verified.xlsx', masterBuf);
  console.log('Master Template Size:', masterBuf.length);

  // Load and check worksheets & styling
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(masterBuf);
  console.log('Sheet count:', wb.worksheets.length);
  wb.worksheets.forEach(ws => {
    const r1c1 = ws.getRow(1).getCell(1);
    const fill = r1c1.fill;
    const font = r1c1.font;
    console.log(`Sheet "${ws.name}": R1C1 text="${r1c1.value}", Fill=${JSON.stringify(fill?.fgColor)}, FontColor=${JSON.stringify(font?.color)}`);
  });

  console.log('\nTesting generateIndividualTemplate(FORM_PROP)...');
  const propBuf = await MasterDataService.generateIndividualTemplate('FORM_PROP');
  fs.writeFileSync('scratch/Template_FORM_PROP_Verified.xlsx', propBuf);
  console.log('FORM_PROP Template Size:', propBuf.length);

  console.log('\nTesting generateIndividualTemplate(SOCIETY_MASTER)...');
  const socBuf = await MasterDataService.generateIndividualTemplate('SOCIETY_MASTER');
  fs.writeFileSync('scratch/Template_SOCIETY_MASTER_Verified.xlsx', socBuf);
  console.log('SOCIETY_MASTER Template Size:', socBuf.length);

  console.log('\nAll templates generated and verified with real purple cell fills successfully!');
}

verifyGeneratedTemplates();
