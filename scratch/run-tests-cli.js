// scratch/run-tests-cli.js
const { TestRunner } = require('../dist/main/tests/TestRunner');

async function run() {
  console.log('Running automated tests via CLI...');
  try {
    const results = await TestRunner.runAll();
    console.log(`Total: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Duration: ${results.durationMs}ms`);
    console.log('\nDetailed Results:');
    for (const r of results.results) {
      if (r.passed) {
        console.log(`✅ [${r.id}] ${r.name}`);
      } else {
        console.log(`❌ [${r.id}] ${r.name}: ${r.message}`);
      }
    }
    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

run();
