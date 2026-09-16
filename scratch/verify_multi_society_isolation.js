// scratch/verify_multi_society_isolation.js
// Complete automated acceptance test suite for Multi-Society Data Isolation Engine.
const { initializeDatabase, getDatabase } = require('../dist/main/db');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService');
const { v4: uuidv4 } = require('uuid');

async function runAcceptanceTest() {
  console.log('====================================================');
  console.log('STARTING MULTI-SOCIETY DATA ISOLATION ACCEPTANCE TEST');
  console.log('====================================================\n');

  const db = initializeDatabase();

  // Clean test records from previous runs
  db.prepare("DELETE FROM societies WHERE id LIKE 'test-soc-%'").run();
  db.prepare("DELETE FROM master_data_sessions WHERE society_id LIKE 'test-soc-%'").run();
  db.prepare("DELETE FROM generation_history WHERE society_id LIKE 'test-soc-%'").run();

  const now = new Date().toISOString();
  const socA_Id = 'test-soc-alpha';
  const socB_Id = 'test-soc-beta';

  // 1. Create Society Alpha and Society Beta
  console.log('[STEP 1] Creating Society Alpha and Society Beta...');
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, created_at, is_active)
    VALUES (?, 'Gokuldham Co-Op Housing Soc', 'REG-ALPHA-001', '01/01/2025', 'Powai, Mumbai', ?, 1)
  `).run(socA_Id, now);

  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, created_at, is_active)
    VALUES (?, 'Vrindavan Residency Co-Op Soc', 'REG-BETA-002', '01/06/2025', 'Andheri, Mumbai', ?, 0)
  `).run(socB_Id, now);

  console.log('✓ Society Alpha and Society Beta created cleanly.');

  // 2. Upload Master Data to Society Alpha (51 records)
  console.log('\n[STEP 2] Uploading 51 Master Data records to Society Alpha...');
  const mockWbAlpha = {
    fileName: 'Alpha_Master.xlsx',
    societyMaster: { societyName: 'Gokuldham Co-Op Housing Soc', registrationNo: 'REG-ALPHA-001' },
    commonFile: Array.from({ length: 51 }, (_, i) => ({
      srNo: String(i + 1).padStart(3, '0'),
      memberName: `Alpha Member ${i + 1}`,
      flatNo: `A-${100 + i + 1}`
    })),
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: now, validationErrors: [], validationWarnings: []
  };

  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count, workbook_json, loaded_at, is_active)
    VALUES (?, ?, ?, ?, ?, 51, ?, ?, 1)
  `).run(uuidv4(), socA_Id, 'Alpha_Master.xlsx', 'Gokuldham Co-Op Housing Soc', 'REG-ALPHA-001', JSON.stringify(mockWbAlpha), now);

  // Add 1 history record to Society Alpha
  db.prepare(`
    INSERT INTO generation_history
    (id, society_id, society_name, form_id, form_label, from_serial, to_serial, total_generated, found_count, blank_count, zip_path, status, generated_at)
    VALUES (?, ?, 'Gokuldham Co-Op Housing Soc', 'FORM_I', 'Form I', '001', '051', 51, 51, 0, 'Alpha_FormI.zip', 'SUCCESS', ?)
  `).run(uuidv4(), socA_Id, now);

  // Save custom Form I setting for Society Alpha
  FormDesignSettingsService.saveSettings('FORM_I', { fontSize: 10, bold: true }, socA_Id);

  console.log('✓ Society Alpha dataset, history, and settings stored.');

  // 3. Verify Society Alpha Data
  console.log('\n[STEP 3] Verifying Society Alpha active data...');
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(socA_Id);

  const activeSocA = db.prepare('SELECT * FROM societies WHERE is_active = 1').get();
  const sessionA = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(socA_Id);
  const historyA = db.prepare('SELECT * FROM generation_history WHERE society_id = ?').all(socA_Id);
  const settingsA = FormDesignSettingsService.getResolvedSettings('FORM_I', socA_Id);

  console.assert(activeSocA.id === socA_Id, 'Active society must be Society Alpha');
  console.assert(sessionA.common_record_count === 51, 'Society Alpha must have 51 records');
  console.assert(historyA.length === 1, 'Society Alpha must have 1 history record');
  console.assert(settingsA.fontSize === 10 && settingsA.bold === true, 'Society Alpha Form I font size must be 10');
  console.log('✓ Society Alpha verification PASSED.');

  // 4. Switch to Society Beta -> Expected: EVERYTHING IS EMPTY
  console.log('\n[STEP 4] Switching to Society Beta (Expecting completely EMPTY datasets)...');
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(socB_Id);

  const sessionB_empty = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(socB_Id);
  const historyB_empty = db.prepare('SELECT * FROM generation_history WHERE society_id = ?').all(socB_Id);
  const settingsB_empty = FormDesignSettingsService.getResolvedSettings('FORM_I', socB_Id);

  console.assert(!sessionB_empty, 'Society Beta master data MUST BE NULL/EMPTY');
  console.assert(historyB_empty.length === 0, 'Society Beta history MUST BE EMPTY (0 files)');
  console.assert(settingsB_empty.fontSize !== settingsA.fontSize, 'Society Beta must NOT inherit Society Alpha custom settings');
  console.log('✓ Society Beta EMPTY state verification PASSED.');

  // 5. Add 10 records to Society Beta
  console.log('\n[STEP 5] Uploading 10 Master Data records to Society Beta...');
  const mockWbBeta = {
    fileName: 'Beta_Master.xlsx',
    societyMaster: { societyName: 'Vrindavan Residency Co-Op Soc', registrationNo: 'REG-BETA-002' },
    commonFile: Array.from({ length: 10 }, (_, i) => ({
      srNo: String(i + 1).padStart(3, '0'),
      memberName: `Beta Member ${i + 1}`,
      flatNo: `B-${200 + i + 1}`
    })),
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: now, validationErrors: [], validationWarnings: []
  };

  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count, workbook_json, loaded_at, is_active)
    VALUES (?, ?, ?, ?, ?, 10, ?, ?, 1)
  `).run(uuidv4(), socB_Id, 'Beta_Master.xlsx', 'Vrindavan Residency Co-Op Soc', 'REG-BETA-002', JSON.stringify(mockWbBeta), now);

  FormDesignSettingsService.saveSettings('FORM_I', { fontSize: 8.5, bold: false }, socB_Id);
  console.log('✓ Society Beta dataset & settings stored.');

  // 6. Switch back to Society Alpha -> Expected: ONLY Society Alpha data (51 records)
  console.log('\n[STEP 6] Switching back to Society Alpha (Expecting ONLY Society Alpha 51 records)...');
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(socA_Id);

  const sessionA_reload = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(socA_Id);
  const historyA_reload = db.prepare('SELECT * FROM generation_history WHERE society_id = ?').all(socA_Id);
  const settingsA_reload = FormDesignSettingsService.getResolvedSettings('FORM_I', socA_Id);

  const wbA = JSON.parse(sessionA_reload.workbook_json);
  console.assert(wbA.commonFile.length === 51, 'Society Alpha must contain exactly 51 records');
  console.assert(historyA_reload.length === 1, 'Society Alpha must contain exactly 1 history file');
  console.assert(settingsA_reload.fontSize === 10, 'Society Alpha font size must remain 10');
  console.log('✓ Switch back to Society Alpha verification PASSED.');

  // 7. Switch back to Society Beta -> Expected: ONLY Society Beta data (10 records)
  console.log('\n[STEP 7] Switching back to Society Beta (Expecting ONLY Society Beta 10 records)...');
  db.prepare('UPDATE societies SET is_active = 0').run();
  db.prepare('UPDATE societies SET is_active = 1 WHERE id = ?').run(socB_Id);

  const sessionB_reload = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(socB_Id);
  const historyB_reload = db.prepare('SELECT * FROM generation_history WHERE society_id = ?').all(socB_Id);
  const settingsB_reload = FormDesignSettingsService.getResolvedSettings('FORM_I', socB_Id);

  const wbB = JSON.parse(sessionB_reload.workbook_json);
  console.assert(wbB.commonFile.length === 10, 'Society Beta must contain exactly 10 records');
  console.assert(historyB_reload.length === 0, 'Society Beta history must be 0 files');
  console.assert(settingsB_reload.fontSize === 8.5, 'Society Beta font size must remain 8.5');
  console.log('✓ Switch back to Society Beta verification PASSED.');

  // Cleanup test data
  db.prepare("DELETE FROM societies WHERE id LIKE 'test-soc-%'").run();
  db.prepare("DELETE FROM master_data_sessions WHERE society_id LIKE 'test-soc-%'").run();
  db.prepare("DELETE FROM generation_history WHERE society_id LIKE 'test-soc-%'").run();

  console.log('\n====================================================');
  console.log('ALL MULTI-SOCIETY ISOLATION ACCEPTANCE TESTS PASSED!');
  console.log('====================================================\n');
}

runAcceptanceTest().catch(err => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
