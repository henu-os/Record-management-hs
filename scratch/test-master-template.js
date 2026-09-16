const fs = require('fs');
const { MasterDataService } = require('../dist/main/services/MasterDataService.js');
const XLSX = require('xlsx');

function testMasterTemplate() {
  console.log('Generating Master Template...');
  const buffer = MasterDataService.generateTemplate();
  fs.writeFileSync('scratch/HENU_OS_Master_Template.xlsx', buffer);

  const wb = XLSX.read(buffer, { type: 'buffer' });
  console.log('Generated Sheet Names:', wb.SheetNames);

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    console.log(`Sheet "${name}" has range:`, ws['!ref']);
  }

  console.log('\nTesting Individual Module Templates:');
  const modules = ['SOCIETY_MASTER', 'COMMON_MEMBER_MASTER', 'FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK', 'FORM_VOUCHER'];
  for (const mod of modules) {
    const buf = MasterDataService.generateIndividualTemplate(mod);
    const mwb = XLSX.read(buf, { type: 'buffer' });
    console.log(`Module ${mod} -> Sheet: ${mwb.SheetNames[0]}`);
  }
}

testMasterTemplate();
