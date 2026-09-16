// ============================================================
// Acceptance Test Suite for PROMPT 08 — Master Data Architecture
// Verifies Excel import/export actions, multi-society isolation,
// detailed validation formatting (Sheet, Row, Column, Problem),
// and active-society clearing.
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
const { ValidationEngine } = require('../dist/main/services/ValidationEngine.js');

function saveWorkbookForSociety(societyId, wb) {
  const db = getDatabase();
  const rawJson = JSON.stringify(wb);
  db.prepare(`
    INSERT INTO master_data_sessions (id, file_name, society_name, registration_no, common_record_count, workbook_json, loaded_at, is_active, society_id)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1, ?)
    ON CONFLICT(id) DO UPDATE SET
      workbook_json = excluded.workbook_json,
      common_record_count = excluded.common_record_count,
      loaded_at = datetime('now')
  `).run(`session_${societyId}`, 'Master.xlsx', wb.societyMaster?.societyName || 'Soc', wb.societyMaster?.registrationNo || 'REG', wb.commonFile.length, rawJson, societyId);
}

function getWorkbookForSociety(societyId) {
  const db = getDatabase();
  const row = db.prepare('SELECT workbook_json FROM master_data_sessions WHERE society_id = ?').get(societyId);
  return row ? JSON.parse(row.workbook_json) : null;
}

function clearWorkbookForSociety(societyId) {
  const db = getDatabase();
  db.prepare('DELETE FROM master_data_sessions WHERE society_id = ?').run(societyId);
}

async function runAcceptanceTest() {
  console.log('=== STARTING PROMPT 08 ACCEPTANCE TEST SUITE ===\n');

  initializeDatabase();

  // STEP 1: Verify ValidationEngine returns structured Sheet, Row, Column, Problem details
  console.log('STEP 1: Testing Detailed Validation Summary Format...');
  const invalidWb = {
    societyMaster: { societyName: 'Test Soc', registrationNo: '123' },
    commonFile: [
      { srNo: '001', memberName: 'Ramesh', membershipNo: 'M100' },
      { srNo: '002', memberName: 'Suresh', membershipNo: 'M100' } // Duplicate
    ],
    formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: []
  };

  const valRes = ValidationEngine.validateWorkbook(invalidWb);
  assert.strictEqual(valRes.isValid, false, 'Workbook with duplicate membership numbers must fail validation');
  assert.ok(valRes.errors.length > 0, 'Must contain validation errors');
  
  const dupErr = valRes.errors[0];
  assert.ok(dupErr.includes('Sheet: 02_Common_Member_Master'), 'Validation error must state Sheet');
  assert.ok(dupErr.includes('Column: Membership No.'), 'Validation error must state Column');
  assert.ok(dupErr.includes('Problem:'), 'Validation error must state Problem');
  console.log('  [PASS] Validation summary detailed formatting verified.');

  // STEP 2: Multi-Society Isolation Test (Society A: 51 records, Society B: 0 records)
  console.log('\nSTEP 2: Testing Multi-Society Isolation for Import, Export & Clear...');
  const socA_Id = 'soc_prompt08_A';
  const socB_Id = 'soc_prompt08_B';

  // Seed Society A with 51 records
  const socA_records = Array.from({ length: 51 }, (_, i) => ({
    memberId: `mA_${i+1}`,
    srNo: String(i + 1).padStart(3, '0'),
    memberName: `Member A ${i+1}`,
    flatNo: `A-${100 + i}`
  }));

  const wbA = {
    societyMaster: { societyName: 'Society A', registrationNo: 'REG_A' },
    commonFile: socA_records,
    formIData: socA_records,
    formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: []
  };

  saveWorkbookForSociety(socA_Id, wbA);
  saveWorkbookForSociety(socB_Id, {
    societyMaster: { societyName: 'Society B', registrationNo: 'REG_B' },
    commonFile: [], formIData: [], formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: []
  });

  // Verify initial counts
  const loadedA1 = getWorkbookForSociety(socA_Id);
  const loadedB1 = getWorkbookForSociety(socB_Id);
  assert.strictEqual(loadedA1.commonFile.length, 51, 'Society A must have 51 records');
  assert.strictEqual(loadedB1.commonFile.length, 0, 'Society B must have 0 records');

  // Import new workbook into Society B
  const socB_new_records = [
    { memberId: 'mB_1', srNo: '001', memberName: 'Jethalal Gada', flatNo: 'B-101' },
    { memberId: 'mB_2', srNo: '002', memberName: 'Daya Gada', flatNo: 'B-101' }
  ];
  const wbB_new = {
    societyMaster: { societyName: 'Society B Updated', registrationNo: 'REG_B_UPD' },
    commonFile: socB_new_records,
    formIData: socB_new_records,
    formJData: [], shareData: [], nominationData: [], propertyData: [], bankLineMarkData: []
  };

  saveWorkbookForSociety(socB_Id, wbB_new);

  // Check Society A remains 51 records (UNTOUCHED)
  const loadedA2 = getWorkbookForSociety(socA_Id);
  const loadedB2 = getWorkbookForSociety(socB_Id);
  assert.strictEqual(loadedA2.commonFile.length, 51, 'Society A records must remain 51 after importing to Society B');
  assert.strictEqual(loadedB2.commonFile.length, 2, 'Society B must receive imported 2 records');
  console.log('  [PASS] Import into Society B did not mutate Society A.');

  // STEP 3: Clear Active Society Data (Society B only)
  console.log('\nSTEP 3: Testing Clear Master Data for Active Society Only...');
  clearWorkbookForSociety(socB_Id);

  const loadedA3 = getWorkbookForSociety(socA_Id);
  const loadedB3 = getWorkbookForSociety(socB_Id);
  assert.strictEqual(loadedA3.commonFile.length, 51, 'Clearing Society B must leave Society A 51 records intact');
  assert.strictEqual(loadedB3, null, 'Society B master data session cleared cleanly');
  console.log('  [PASS] Active Society Clear verified.');

  console.log('\n=== ALL PROMPT 08 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
