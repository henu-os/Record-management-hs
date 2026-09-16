// ============================================================
// Acceptance Test Suite for PROMPT 09 — UI Consistency & Usability
// Verifies CSS design tokens for Light Mode and Dark Mode,
// sidebar sub-items (Form I..Share Certificate), button hierarchy,
// and layout consistency across all views.
// ============================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function runAcceptanceTest() {
  console.log('=== STARTING PROMPT 09 ACCEPTANCE TEST SUITE ===\n');

  // STEP 1: CSS Theme Tokens & Controls Verification
  console.log('STEP 1: Verifying index.css Light & Dark Mode design tokens...');
  const cssSource = fs.readFileSync(path.join(__dirname, '../src/renderer/index.css'), 'utf-8');

  assert.ok(cssSource.includes('--bg: #F1F5F9') || cssSource.includes('--bg: #F4F6FA'), 'Light Mode --bg token must be defined');
  assert.ok(cssSource.includes('--surface: #FFFFFF'), 'Light Mode --surface token must be #FFFFFF');
  assert.ok(cssSource.includes('[data-theme=\'dark\']'), 'Dark Mode [data-theme="dark"] selector must be defined');
  assert.ok(cssSource.includes('--btn-primary') || cssSource.includes('.btn-primary'), '.btn-primary button style must be defined');
  assert.ok(cssSource.includes('.btn-secondary'), '.btn-secondary button style must be defined');
  assert.ok(cssSource.includes('.btn-danger'), '.btn-danger button style must be defined');
  console.log('  [PASS] Light Mode and Dark Mode CSS tokens and button hierarchy verified.');

  // STEP 2: Sidebar Navigation Sub-Items Verification
  console.log('\nSTEP 2: Verifying Sidebar Navigation Items...');
  const appSource = fs.readFileSync(path.join(__dirname, '../src/renderer/App.tsx'), 'utf-8');

  const requiredSubItems = [
    'Form I',
    'Form J',
    'Share Register',
    'Property Register',
    'Nomination Register',
    'Bank Lien Mark',
    'Share Certificate'
  ];

  for (const item of requiredSubItems) {
    assert.ok(appSource.includes(item), `Sidebar navigation must include sub-item "${item}"`);
  }
  console.log('  [PASS] Sidebar Navigation sub-items verified.');

  // STEP 3: Modal Container Styling Verification
  console.log('\nSTEP 3: Verifying Modal Containers Light Mode compatibility...');
  const modalSource = fs.readFileSync(path.join(__dirname, '../src/renderer/components/EditDataModal.tsx'), 'utf-8');

  assert.ok(modalSource.includes('var(--surface)'), 'EditDataModal container must use CSS variable var(--surface) for theme compatibility');
  console.log('  [PASS] Modal Light/Dark Mode theme compatibility verified.');

  console.log('\n=== ALL PROMPT 09 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
