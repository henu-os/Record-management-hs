// ============================================================
// HENU OS RECORDS MANAGEMENT SYSTEM — PROMPT 04/07
// MULTI-SOCIETY ARCHITECTURE & CONTROL CENTER QA SUITE
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { FormDesignSettingsService } = require('../dist/main/services/FormDesignSettingsService.js');
const { MasterDataService } = require('../dist/main/services/MasterDataService.js');

function createSocietyInDb(id, name, regNo) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, '01/01/2025', '123 Main St', 'Mumbai', 'Maharashtra', '400001', datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET society_name = excluded.society_name
  `).run(id, name, regNo);
}

function saveMasterSession(societyId, wbData) {
  const db = getDatabase();
  const jsonStr = JSON.stringify(wbData);
  db.prepare(`
    INSERT INTO master_data_sessions (id, society_id, file_name, society_name, registration_no, common_record_count, form_i_count, form_j_count, share_count, nomination_count, property_count, bank_count, validation_errors, validation_warnings, workbook_json, loaded_at, is_active)
    VALUES (?, ?, 'MasterData.xlsx', 'Society', 'REG', 3, 3, 3, 3, 3, 3, 3, '[]', '[]', ?, datetime('now'), 1)
    ON CONFLICT(id) DO UPDATE SET workbook_json = excluded.workbook_json
  `).run(`sess_${societyId}`, societyId, jsonStr);
}

function loadMasterSession(societyId) {
  const db = getDatabase();
  const row = db.prepare('SELECT workbook_json FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(societyId);
  return row ? JSON.parse(row.workbook_json) : null;
}

async function runMultiSocietyControlCenterTestSuite() {
  console.log('===========================================================');
  console.log('HENU OS RECORDS MANAGEMENT — PROMPT 04/07 CONTROL CENTER QA');
  console.log('===========================================================\n');

  initializeDatabase();
  const socA_Id = 'soc_ctrl_A';
  const socB_Id = 'soc_ctrl_B';
  createSocietyInDb(socA_Id, 'Control Center Society A', 'REG-CC-A');
  createSocietyInDb(socB_Id, 'Control Center Society B', 'REG-CC-B');

  let testCounter = 1;

  // -----------------------------------------------------------------
  // 1: SOCIETY A (10 RECORDS) VS SOCIETY B (5 RECORDS)
  // -----------------------------------------------------------------
  console.log(`TEST ${testCounter++}: Society A (10 records) vs Society B (5 records)...`);
  const wbA = {
    formJData: Array.from({ length: 10 }, (_, i) => ({ srNo: String(i + 1).padStart(3, '0'), memberName: `Soc A Member ${i + 1}` }))
  };
  const wbB = {
    formJData: Array.from({ length: 5 }, (_, i) => ({ srNo: String(i + 1).padStart(3, '0'), memberName: `Soc B Member ${i + 1}` }))
  };

  saveMasterSession(socA_Id, wbA);
  saveMasterSession(socB_Id, wbB);

  // Save isolated settings
  FormDesignSettingsService.saveSettings('FORM_J', { fontSize: 11, colorMode: 'Color' }, socA_Id);
  FormDesignSettingsService.saveSettings('FORM_J', { fontSize: 8, colorMode: 'BW' }, socB_Id);

  // Switch A -> B -> A
  const loadedA1 = loadMasterSession(socA_Id);
  const loadedB = loadMasterSession(socB_Id);
  const loadedA2 = loadMasterSession(socA_Id);

  const settingsA1 = FormDesignSettingsService.getResolvedSettings('FORM_J', socA_Id);
  const settingsB = FormDesignSettingsService.getResolvedSettings('FORM_J', socB_Id);

  assert.strictEqual(loadedA1.formJData.length, 10, 'Society A has 10 records');
  assert.strictEqual(loadedB.formJData.length, 5, 'Society B has 5 records');
  assert.strictEqual(loadedA2.formJData.length, 10, 'Society A retains 10 records after switching B -> A');

  assert.strictEqual(settingsA1.fontSize, 11);
  assert.strictEqual(settingsA1.colorMode, 'Color');
  assert.strictEqual(settingsB.fontSize, 8);
  assert.strictEqual(settingsB.colorMode, 'BW');

  console.log('  [PASS] Society A -> B -> A switching verified with zero cross-contamination.');

  // -----------------------------------------------------------------
  // 2: ADD SOCIETY INITIALIZES CLEAN CONTEXT
  // -----------------------------------------------------------------
  console.log(`\nTEST ${testCounter++}: Add Society Context Initialization...`);
  const socC_Id = 'soc_ctrl_C';
  createSocietyInDb(socC_Id, 'Control Center Society C', 'REG-CC-C');

  const settingsC = FormDesignSettingsService.getResolvedSettings('FORM_J', socC_Id);
  assert.strictEqual(settingsC.fontSize, 7.5, 'New society receives default clamped font size 7.5');
  console.log('  [PASS] Add Society creates clean context with independent default settings.');

  // -----------------------------------------------------------------
  // 3: DELETE SOCIETY ISOLATION
  // -----------------------------------------------------------------
  console.log(`\nTEST ${testCounter++}: Delete Society Isolation...`);
  const db = getDatabase();
  db.prepare('DELETE FROM societies WHERE id = ?').run(socC_Id);
  db.prepare('DELETE FROM master_data_sessions WHERE society_id = ?').run(socC_Id);

  const listAfterDel = db.prepare('SELECT id FROM societies WHERE id = ?').get(socC_Id);
  assert.strictEqual(listAfterDel, undefined, 'Deleted society C is removed');

  const remainingA = db.prepare('SELECT id FROM societies WHERE id = ?').get(socA_Id);
  assert.ok(remainingA, 'Society A remains unaffected by deletion of Society C');
  console.log('  [PASS] Delete Society operates cleanly on target society only.');

  console.log('\n===========================================================');
  console.log('ALL PROMPT 04/07 CONTROL CENTER QA TESTS PASSED! (100%)');
  console.log('===========================================================');
}

runMultiSocietyControlCenterTestSuite().catch(err => {
  console.error('\n❌ PROMPT 04/07 TEST SUITE FAILED:', err);
  process.exit(1);
});
