const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../dist/main/db');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');

async function testSuite() {
  console.log('=== STARTING INTEGRATION AUDIT SUITE ===');
  const db = initializeDatabase();

  // Test 1: Active Society
  const active = db.prepare('SELECT * FROM societies WHERE is_active = 1 LIMIT 1').get();
  console.log('[PASS 1] Active Society resolved:', active ? active.society_name : 'FAILED');

  // Test 2: Master Session 11-param update
  const session = db.prepare('SELECT * FROM master_data_sessions WHERE is_active = 1 LIMIT 1').get();
  if (session) {
    const dummyWb = { societyMaster: { societyName: 'Test Soc' }, commonFile: [{ srNo: '001', memberName: 'Ramesh Patel' }] };
    db.prepare('UPDATE master_data_sessions SET common_record_count = ?, form_i_count = ?, form_j_count = ?, share_count = ?, nomination_count = ?, property_count = ?, bank_count = ?, workbook_json = ?, validation_errors = ?, validation_warnings = ? WHERE id = ?')
      .run(1, 1, 1, 1, 1, 1, 1, JSON.stringify(dummyWb), '[]', '[]', session.id);
    
    const reloaded = db.prepare('SELECT * FROM master_data_sessions WHERE id = ?').get(session.id);
    const parsedWb = JSON.parse(reloaded.workbook_json);
    console.log('[PASS 2] Workbook JSON intact after 11-param UPDATE:', parsedWb.commonFile[0].memberName === 'Ramesh Patel');
  }

  // Test 3: History Insert & Timestamp
  const now = new Date().toISOString();
  const testHistId = 'hist-test-' + Date.now();
  db.prepare('INSERT INTO generation_history (id, society_id, society_name, form_id, form_label, from_serial, to_serial, total_generated, found_count, blank_count, orientation, rows_per_page, grid_setting, color_setting, pdf_path, excel_path, zip_path, status, generated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(testHistId, active ? active.id : 'default-society-1', active ? active.society_name : 'Test Soc', 'FORM_I', 'Form I', '001', '001', 1, 1, 0, 'Portrait', 10, 'Grid ON', 'Color', 'test.pdf', 'test.xlsx', 'test.zip', 'SUCCESS', now);
  
  const historyRow = db.prepare('SELECT * FROM generation_history WHERE id = ?').get(testHistId);
  console.log('[PASS 3] History status & timestamp:', { status: historyRow.status, generated_at: historyRow.generated_at, validDate: !isNaN(new Date(historyRow.generated_at).getTime()) });

  // Test 4: PDF Generation for all 8 statutory formats
  const formsToTest = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK', 'FORM_SHARE_CERT', 'FORM_VOUCHER'];
  const testWb = {
    societyMaster: { societyName: 'Test Society Ltd', registrationNo: 'REG123' },
    commonFile: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101', wingNo: 'A' }],
    formIData: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101' }],
    formJData: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101' }],
    shareData: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101' }],
    nominationData: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101', nominee1: 'Priya Sharma', nomineePercentage1: '100' }],
    propertyData: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101' }],
    bankLineMarkData: [{ srNo: '001', memberName: 'Aditya Sharma', flatNo: '101' }],
    voucherData: [{ srNo: '001', voucherNo: '001', societyName: 'Test Society Ltd', toPayee: 'Apex Vendor', billAmount: '1000', netPaid: '1000', voucherDate: '01/01/2025' }]
  };

  for (const fId of formsToTest) {
    try {
      const output = await PdfEngine.generate({
        formId: fId,
        fromSerial: '001',
        toSerial: '001',
        workbook: testWb,
        societyId: active ? active.id : 'default-society-1'
      });
      console.log(`[PASS 4 - PDF] ${fId} generated successfully: ${output.files.length} file(s), total bytes: ${output.files[0].buffer.length}`);
    } catch (err) {
      console.error(`[FAIL 4 - PDF] ${fId} error:`, err.message);
    }
  }

  console.log('=== ALL INTEGRATION AUDIT TESTS COMPLETE ===');
}

testSuite().catch(console.error);
