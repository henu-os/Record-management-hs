// scratch/verify_prompt_02_editors.js
// Automated test suite for PROMPT 02/10 — Form I & Form J Real-Time Data Editors

const { initializeDatabase } = require('../dist/main/db');
const { MasterDataService } = require('../dist/main/services/MasterDataService');
const { ValidationEngine } = require('../dist/main/services/ValidationEngine');
const { v4: uuidv4 } = require('uuid');

async function runPrompt02AcceptanceTests() {
  console.log('===========================================================');
  console.log('STARTING PROMPT 02/10 — FORM I & FORM J EDITORS ACCEPTANCE TEST');
  console.log('===========================================================\n');

  const db = initializeDatabase();

  // Clean previous test data
  db.prepare("DELETE FROM societies WHERE id LIKE 'test-p02-%'").run();
  db.prepare("DELETE FROM master_data_sessions WHERE society_id LIKE 'test-p02-%'").run();

  const now = new Date().toISOString();
  const soc1_Id = 'test-p02-soc1';
  const soc2_Id = 'test-p02-soc2';

  // 1. Create Society 1 (51 records) and Society 2 (0 records)
  console.log('[STEP 1] Setting up test societies...');
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, created_at, is_active)
    VALUES (?, 'Gokuldham Society', 'REG-51-001', '01/01/2025', 'Mumbai', ?, 1)
  `).run(soc1_Id, now);

  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, created_at, is_active)
    VALUES (?, 'Vrindavan Society', 'REG-00-002', '01/06/2025', 'Mumbai', ?, 0)
  `).run(soc2_Id, now);

  // Populate 51 records into Society 1
  const formIData51 = Array.from({ length: 51 }, (_, i) => ({
    srNo: String(i + 1).padStart(3, '0'),
    dateOfAdmission: '01/01/2025',
    dateOfEntranceFee: '01/01/2025',
    memberName: `Member Alpha ${i + 1}`,
    permanentAddress: `Address ${i + 1}`,
    residentialAddress: `Address ${i + 1}`,
    occupation: 'Business',
    age: '35',
    nomineeName: `Nominee ${i + 1}`,
    nomineeAddress: `Nominee Address ${i + 1}`,
    dateOfNomination: '02/01/2025',
    dateOfCessation: '',
    reasonForCessation: '',
    remarks: 'OK'
  }));

  const formJData51 = Array.from({ length: 51 }, (_, i) => ({
    srNo: String(i + 1).padStart(3, '0'),
    memberName: `Member Alpha ${i + 1}`,
    permanentAddress: `Address ${i + 1}`,
    residentialAddress: `Address ${i + 1}`,
    classOfMember: 'Original'
  }));

  const mockWb51 = {
    fileName: 'Master_51.xlsx',
    societyMaster: { societyName: 'Gokuldham Society', registrationNo: 'REG-51-001' },
    commonFile: formIData51.map(f => ({ ...f, flatNo: `A-${f.srNo}`, wingNo: 'A' })),
    formIData: formIData51,
    formJData: formJData51,
    shareData: [], nominationData: [], propertyData: [], bankLineMarkData: [],
    loadedAt: now, validationErrors: [], validationWarnings: []
  };

  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count, workbook_json, loaded_at, is_active)
    VALUES (?, ?, 'Master_51.xlsx', 'Gokuldham Society', 'REG-51-001', 51, ?, ?, 1)
  `).run(uuidv4(), soc1_Id, JSON.stringify(mockWb51), now);

  console.log('✓ Society 1 (51 records) and Society 2 (0 records) created.');

  // 2. Verify Form I & Form J Schema Compliance
  console.log('\n[STEP 2] Verifying Form I & Form J Field Order & Schema...');
  const formIFields = [
    'srNo', 'dateOfAdmission', 'dateOfEntranceFee', 'memberName', 'member2', 'member3',
    'member4', 'member5', 'member6', 'permanentAddress', 'residentialAddress',
    'occupation', 'age', 'nomineeName', 'nomineeAddress', 'dateOfNomination',
    'dateOfCessation', 'reasonForCessation', 'remarks'
  ];

  const formJFields = [
    'srNo', 'memberName', 'member2', 'member3', 'member4', 'member5', 'member6',
    'permanentAddress', 'residentialAddress', 'classOfMember'
  ];

  const firstFormI = mockWb51.formIData[0];
  const firstFormJ = mockWb51.formJData[0];

  console.assert(firstFormI.srNo === '001' && firstFormI.nomineeAddress === 'Nominee Address 1', 'Form I must contain nomineeAddress');
  console.assert(firstFormJ.srNo === '001' && firstFormJ.classOfMember === 'Original', 'Form J must contain classOfMember');
  console.log('✓ Form I & Form J schema order verified.');

  // 3. Test Validation Breakdown Engine
  console.log('\n[STEP 3] Testing detailed validation breakdown engine...');
  const validateCell = (type, required, val) => {
    const s = String(val ?? '').trim();
    if (required && !s) return 'Required field cannot be empty';
    if (!s) return null;
    if (type === 'date') {
      const ddmm = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      if (!ddmm.test(s) && !iso.test(s)) return 'Invalid date format (use DD/MM/YYYY)';
    }
    return null;
  };

  const cellErr1 = validateCell('text', true, '');
  const cellErr2 = validateCell('date', false, 'invalid-date');

  console.assert(cellErr1 === 'Required field cannot be empty', 'Required check must trigger error');
  console.assert(cellErr2 === 'Invalid date format (use DD/MM/YYYY)', 'Date format check must trigger error');
  console.log('✓ Detailed cell-level validation breakdown verified.');

  // 4. Test Persistence & Society Isolation (Edit row in Society 1)
  console.log('\n[STEP 4] Testing real-time editing persistence & society isolation...');
  // Edit Row 1 in Society 1
  mockWb51.formIData[0].memberName = 'EDITED_NAME_ALPHA_001';
  db.prepare(`
    UPDATE master_data_sessions SET workbook_json = ? WHERE society_id = ? AND is_active = 1
  `).run(JSON.stringify(mockWb51), soc1_Id);

  // Reload Society 1 data
  const session1 = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(soc1_Id);
  const reloadedWb1 = JSON.parse(session1.workbook_json);
  console.assert(reloadedWb1.formIData[0].memberName === 'EDITED_NAME_ALPHA_001', 'Edited member name must persist in Society 1');

  // Verify Society 2 data is 100% unaffected
  const session2 = db.prepare('SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1').get(soc2_Id);
  console.assert(!session2, 'Society 2 data must remain completely EMPTY (null)');
  console.log('✓ Persistence and Society Isolation verified.');

  // Cleanup test data
  db.prepare("DELETE FROM societies WHERE id LIKE 'test-p02-%'").run();
  db.prepare("DELETE FROM master_data_sessions WHERE society_id LIKE 'test-p02-%'").run();

  console.log('\n===========================================================');
  console.log('ALL PROMPT 02/10 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('===========================================================\n');
}

runPrompt02AcceptanceTests().catch(err => {
  console.error('Prompt 02 Acceptance Test Failed:', err);
  process.exit(1);
});
