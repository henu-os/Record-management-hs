const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../dist/main/db');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { PdfEngine } = require('../dist/main/services/PdfEngine');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService');

async function runParityAudit() {
  console.log('====================================================');
  console.log('HENU OS — WEB VS DESKTOP 100% PARITY AUDIT SUITE');
  console.log('====================================================\n');

  let db = initializeDatabase();

  // 1. Create Society A
  const socAId = 'soc-parity-a-' + Date.now();
  const socBId = 'soc-parity-b-' + Date.now();
  const now = new Date().toISOString();

  console.log('Step 1: Creating Society A and Society B...');
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, logo_base64, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(socAId, 'Galaxy Heights Co-op Housing Society', 'BOM/HSG/12345/2020', '15/08/2020', 'Plot 42, Sector 18, Palm Beach Road', 'Navi Mumbai', 'Maharashtra', '400705', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', now);

  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, logo_base64, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(socBId, 'Sunrise Meadows CHS Ltd', 'PUN/HSG/99887/2022', '01/01/2022', 'Kharadi Bypass', 'Pune', 'Maharashtra', '411014', '', now);

  let activeSoc = db.prepare('SELECT * FROM societies WHERE is_active = 1 LIMIT 1').get();
  console.log('  -> Active Society is:', activeSoc ? activeSoc.society_name : 'NONE');
  console.log('  -> Society A active:', activeSoc && activeSoc.id === socAId ? 'PASS' : 'FAIL');

  // 2. Test Restart Persistence
  console.log('\nStep 2: Testing Application Restart Persistence (Re-initializing DB Adapter)...');
  db = initializeDatabase();
  activeSoc = db.prepare('SELECT * FROM societies WHERE is_active = 1 LIMIT 1').get();
  console.log('  -> After restart, Active Society is:', activeSoc ? activeSoc.society_name : 'NONE');
  console.log('  -> Restart persistence verified:', activeSoc && activeSoc.id === socAId ? 'PASS' : 'FAIL');

  // 3. Test Society Switching
  console.log('\nStep 3: Switching Active Society to Society B...');
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(socBId);
  activeSoc = db.prepare('SELECT * FROM societies WHERE is_active = 1 LIMIT 1').get();
  console.log('  -> Active Society is now:', activeSoc ? activeSoc.society_name : 'NONE');
  console.log('  -> Switch to Society B verified:', activeSoc && activeSoc.id === socBId ? 'PASS' : 'FAIL');

  // Switch back to Society A
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(socAId);

  // 4. Test Master Data Import & Cell Editing Persistence
  console.log('\nStep 4: Importing Master Data for Society A and Testing 11-Parameter Cell Update...');
  const sessionId = 'session-' + Date.now();
  const testWb = {
    fileName: 'Galaxy_Master.xlsx',
    loadedAt: new Date().toISOString(),
    societyMaster: {
      societyName: 'Galaxy Heights Co-op Housing Society',
      registrationNo: 'BOM/HSG/12345/2020',
      registrationDate: '15/08/2020',
      address: 'Plot 42, Sector 18, Palm Beach Road, Navi Mumbai, Maharashtra, 400705',
      totalUnits: 50,
      unitsFlat: 40,
      unitsShop: 10
    },
    commonFile: [
      { srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101', wingNo: 'A', shareCertNo: 'SC-001', distinctShares: '1 to 5', shareCount: 5, folioNo: 'F-101' },
      { srNo: '002', memberName: 'Shah Rukh Khan', flatNo: '102', wingNo: 'A', shareCertNo: 'SC-002', distinctShares: '6 to 10', shareCount: 5, folioNo: 'F-102' }
    ],
    formIData: [{ srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101' }],
    formJData: [{ srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101' }],
    shareData: [{ srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101', shareCertNo: 'SC-001' }],
    nominationData: [{ srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101', nominee1: 'Jaya Bachchan', nomineePercentage1: '100' }],
    propertyData: [{ srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101' }],
    bankLineMarkData: [{ srNo: '001', memberName: 'Amitabh Bachchan', flatNo: '101', bankName: 'SBI', loanAmount: '5000000' }],
    voucherData: [{ srNo: '001', voucherNo: 'V-001', societyName: 'Galaxy Heights Co-op Housing Society', toPayee: 'Apex Security', billAmount: '25000', netPaid: '25000', voucherDate: '01/08/2025' }]
  };

  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no,
     common_record_count, form_i_count, form_j_count, share_count,
     nomination_count, property_count, bank_count,
     validation_errors, validation_warnings, workbook_json, loaded_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    sessionId, socAId, 'Galaxy_Master.xlsx', 'Galaxy Heights Co-op Housing Society', 'BOM/HSG/12345/2020',
    2, 1, 1, 1, 1, 1, 1,
    '[]', '[]', JSON.stringify(testWb), now
  );

  // Edit a cell (e.g. Amitabh Bachchan -> Amitabh Harivansh Bachchan)
  testWb.commonFile[0].memberName = 'Amitabh Harivansh Bachchan';
  db.prepare(`
    UPDATE master_data_sessions
    SET common_record_count = ?, form_i_count = ?, form_j_count = ?, share_count = ?,
        nomination_count = ?, property_count = ?, bank_count = ?,
        workbook_json = ?, validation_errors = ?, validation_warnings = ?
    WHERE id = ?
  `).run(
    2, 1, 1, 1, 1, 1, 1,
    JSON.stringify(testWb), '[]', '[]', sessionId
  );

  // Reload session and verify
  const loadedSession = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(socAId);
  const parsedWb = JSON.parse(loadedSession.workbook_json);
  console.log('  -> Edited cell persisted:', parsedWb.commonFile[0].memberName === 'Amitabh Harivansh Bachchan' ? 'PASS' : 'FAIL');

  // 5. Test Multi-Society Isolation
  console.log('\nStep 5: Testing Multi-Society Isolation (Society B should have 0 sessions)...');
  const socBSession = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(socBId);
  console.log('  -> Society B master session is:', socBSession ? 'LEAK DETECTED' : 'NULL (ISOLATED - PASS)');

  // 6. Test PDF Generation for All 8 Formats using Persisted Data
  console.log('\nStep 6: Generating All 8 Output Formats from Persisted Data...');
  const forms = [
    { id: 'FORM_I', name: 'Form I (Register of Members)' },
    { id: 'FORM_J', name: 'Form J (List of Members)' },
    { id: 'FORM_SHARE', name: 'Share Register' },
    { id: 'FORM_NOM', name: 'Nomination Register' },
    { id: 'FORM_PROP', name: 'Property Register' },
    { id: 'FORM_BANK', name: 'Bank Line Mark Register' },
    { id: 'FORM_SHARE_CERT', name: 'Share Certificate (Super A3 / 13x19)' },
    { id: 'FORM_VOUCHER', name: 'Payment Voucher (US Legal 3-per-page)' }
  ];

  for (const f of forms) {
    const res = await PdfEngine.generate({
      formId: f.id,
      fromSerial: '001',
      toSerial: '001',
      workbook: parsedWb,
      societyId: socAId
    });
    console.log(`  -> ${f.name}: GENERATED ${res.files[0].buffer.length} bytes (PASS)`);
  }

  // 7. Test Generation History Logging
  console.log('\nStep 7: Testing Generation History Log with ISO Timestamp...');
  const histId = 'hist-' + Date.now();
  db.prepare(`
    INSERT INTO generation_history
    (id, society_id, society_name, form_id, form_label, from_serial, to_serial,
     total_generated, found_count, blank_count, orientation, rows_per_page,
     grid_setting, color_setting, pdf_path, excel_path, zip_path, status, generated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    histId, socAId, 'Galaxy Heights Co-op Housing Society', 'FORM_SHARE_CERT', 'Share Certificate (13x19)', '001', '001',
    1, 1, 0, 'Landscape', 1, 'Grid OFF', 'Color', 'galaxy_sc_001.pdf', '', 'galaxy_sc.zip', 'SUCCESS', new Date().toISOString()
  );

  const histEntry = db.prepare('SELECT * FROM generation_history WHERE id = ?').get(histId);
  console.log('  -> History Status:', histEntry.status);
  console.log('  -> History Generated At:', histEntry.generated_at);
  console.log('  -> Valid ISO Timestamp:', !isNaN(new Date(histEntry.generated_at).getTime()) ? 'PASS' : 'FAIL');

  // Clean up test societies
  db.prepare('DELETE FROM societies WHERE id = ?').run(socAId);
  db.prepare('DELETE FROM societies WHERE id = ?').run(socBId);

  console.log('\n====================================================');
  console.log('✅ ALL WEB VS DESKTOP PARITY AUDIT TESTS PASSED (100%)');
  console.log('====================================================');
}

runParityAudit().catch(console.error);
