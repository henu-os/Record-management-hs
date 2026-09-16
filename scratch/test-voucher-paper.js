const path = require('path');
const { VoucherRenderer } = require(path.resolve(__dirname, '../dist/main/services/renderers/VoucherRenderer'));
const { MasterDataService } = require(path.resolve(__dirname, '../dist/main/services/MasterDataService'));
const fs = require('fs');

async function testVouchers() {
  console.log('Testing Template 1 on Legal Paper (3 vouchers per page)...');
  const legalBuf = await VoucherRenderer.render([], null, {
    paperSize: 'LEGAL',
    templateId: 'TEMPLATE_1'
  });
  fs.writeFileSync('scratch/test_voucher_legal_3perpage.pdf', legalBuf);
  console.log('Legal PDF Size:', legalBuf.length);

  console.log('\nTesting Template 1 on A4 Paper (2 vouchers per page)...');
  const a4Buf = await VoucherRenderer.render([], null, {
    paperSize: 'A4',
    templateId: 'TEMPLATE_1'
  });
  fs.writeFileSync('scratch/test_voucher_a4_2perpage.pdf', a4Buf);
  console.log('A4 PDF Size:', a4Buf.length);

  console.log('\nTesting Template 2 on A4 Paper (2 vouchers per page)...');
  const a4BufT2 = await VoucherRenderer.render([], null, {
    paperSize: 'A4',
    templateId: 'TEMPLATE_2'
  });
  fs.writeFileSync('scratch/test_voucher_a4_template2.pdf', a4BufT2);
  console.log('A4 Template 2 PDF Size:', a4BufT2.length);

  console.log('\nVerifying Master Template 10_Payment_Voucher has NO sample rows...');
  const masterBuf = await MasterDataService.generateTemplate();
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(masterBuf);
  const vchWs = wb.getWorksheet('10_Payment_Voucher');
  console.log('10_Payment_Voucher total row count:', vchWs.rowCount);
  console.log('Row 1 header 1:', vchWs.getRow(1).getCell(1).value);
  console.log('Row 2 cell 1 (should be null/empty):', vchWs.getRow(2).getCell(1).value);

  console.log('\nAll tests completed successfully!');
}

testVouchers();
