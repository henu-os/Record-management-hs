// scratch/verify_multi_society.js
// Automated verification script for Prompt 02 Multi-Society Management & Isolation
const path = require('path');
const fs = require('fs');

console.log('=== MULTI-SOCIETY ISOLATION VERIFICATION TEST ===\n');

try {
  // Test loading db and running migrations
  const { initializeDatabase, getDatabase } = require('../dist/main/db.js');
  initializeDatabase();
  const db = getDatabase();

  console.log('✔ Database initialized and migrations applied successfully.');

  // Clean test societies if any
  db.prepare("DELETE FROM societies WHERE id LIKE 'test-%'").run();
  db.prepare("DELETE FROM master_data_sessions WHERE society_id LIKE 'test-%'").run();
  db.prepare("DELETE FROM generation_history WHERE society_id LIKE 'test-%'").run();

  const now = new Date().toISOString();

  // 1. Create Society A
  const socA_id = 'test-soc-a';
  const socA_name = 'Green Valley Co-op Society';
  const socA_reg = 'REG-GV-101';

  db.prepare("UPDATE societies SET is_active = 0").run();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, '01/01/2024', '123 Main St', 'Mumbai', 'Maharashtra', '400001', ?, 1)
  `).run(socA_id, socA_name, socA_reg, now);

  console.log(`✔ Created Society A: "${socA_name}" (${socA_reg})`);

  // 2. Create Society B
  const socB_id = 'test-soc-b';
  const socB_name = 'Sunrise Heights Co-op Society';
  const socB_reg = 'REG-SH-202';

  db.prepare("UPDATE societies SET is_active = 0").run();
  db.prepare(`
    INSERT INTO societies (id, society_name, registration_no, registration_date, full_address, city, state, pin_code, created_at, is_active)
    VALUES (?, ?, ?, '15/06/2024', '456 Park Ave', 'Pune', 'Maharashtra', '411001', ?, 1)
  `).run(socB_id, socB_name, socB_reg, now);

  console.log(`✔ Created Society B: "${socB_name}" (${socB_reg})`);

  // 3. Select Society A and attach data
  db.prepare("UPDATE societies SET is_active = 0").run();
  db.prepare("UPDATE societies SET is_active = 1 WHERE id = ?").run(socA_id);

  const active1 = db.prepare("SELECT * FROM societies WHERE is_active = 1").get();
  if (active1.id !== socA_id) throw new Error('Active society selection failed for Society A!');
  console.log(`✔ Selected Active Society: ${active1.society_name}`);

  // Insert master data session for A
  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count, form_i_count, form_j_count, share_count, nomination_count, property_count, bank_count, workbook_json, loaded_at, is_active)
    VALUES ('sess-a', ?, 'Master_A.xlsx', ?, ?, 25, 25, 25, 25, 25, 25, 25, '{}', ?, 1)
  `).run(socA_id, socA_name, socA_reg, now);

  // Insert generation history for A
  db.prepare(`
    INSERT INTO generation_history (id, society_id, form_id, form_label, from_serial, to_serial, total_generated, found_count, blank_count, zip_path, generated_at)
    VALUES ('gen-a1', ?, 'FORM_I', 'Form I', '001', '010', 10, 10, 0, 'A.zip', ?)
  `).run(socA_id, now);

  console.log('✔ Master Data & Generation History attached to Society A.');

  // 4. Select Society B and attach data
  db.prepare("UPDATE societies SET is_active = 0").run();
  db.prepare("UPDATE societies SET is_active = 1 WHERE id = ?").run(socB_id);

  const active2 = db.prepare("SELECT * FROM societies WHERE is_active = 1").get();
  if (active2.id !== socB_id) throw new Error('Active society selection failed for Society B!');
  console.log(`✔ Selected Active Society: ${active2.society_name}`);

  // Query master data for B (should be empty before insert)
  const masterB_pre = db.prepare("SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1").get(socB_id);
  if (masterB_pre) throw new Error('Society B leaked master data from Society A!');
  console.log('✔ Verified Society B master data is isolated and empty before upload.');

  // Insert master data session for B
  db.prepare(`
    INSERT INTO master_data_sessions
    (id, society_id, file_name, society_name, registration_no, common_record_count, form_i_count, form_j_count, share_count, nomination_count, property_count, bank_count, workbook_json, loaded_at, is_active)
    VALUES ('sess-b', ?, 'Master_B.xlsx', ?, ?, 50, 50, 50, 50, 50, 50, 50, '{}', ?, 1)
  `).run(socB_id, socB_name, socB_reg, now);

  // 5. Select back to Society A and verify data integrity
  db.prepare("UPDATE societies SET is_active = 0").run();
  db.prepare("UPDATE societies SET is_active = 1 WHERE id = ?").run(socA_id);

  const active3 = db.prepare("SELECT * FROM societies WHERE is_active = 1").get();
  if (active3.id !== socA_id) throw new Error('Re-selection failed for Society A!');

  const masterA_post = db.prepare("SELECT * FROM master_data_sessions WHERE society_id = ? AND is_active = 1").get(socA_id);
  if (!masterA_post || masterA_post.common_record_count !== 25) {
    throw new Error('Society A master data corrupted after switching!');
  }

  const histA = db.prepare("SELECT * FROM generation_history WHERE society_id = ?").all(socA_id);
  if (histA.length !== 1 || histA[0].zip_path !== 'A.zip') {
    throw new Error('Society A generation history leaked or missing!');
  }

  console.log(`✔ Switch back to Society A verified: 25 common records intact, generation history isolated.`);

  // Cleanup test societies
  db.prepare("DELETE FROM societies WHERE id LIKE 'test-%'").run();
  db.prepare("DELETE FROM master_data_sessions WHERE society_id LIKE 'test-%'").run();
  db.prepare("DELETE FROM generation_history WHERE society_id LIKE 'test-%'").run();

  console.log('\n=================================================');
  console.log('🎉 ALL MULTI-SOCIETY TESTS PASSED 100% PERFECTLY!');
  console.log('=================================================\n');
} catch (err) {
  console.error('❌ MULTI-SOCIETY TEST FAILED:', err.message);
  process.exit(1);
}
