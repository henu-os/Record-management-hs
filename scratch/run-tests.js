const { TestRunner } = require('../dist/main/tests/TestRunner.js');
TestRunner.runAll().then(res => {
  console.log(`Passed: ${res.passed}/${res.total}`);
  if (res.failed > 0) {
    console.error("FAILED TESTS:", res.results.filter(r => !r.passed));
    process.exit(1);
  } else {
    console.log("All tests passed successfully!");
    process.exit(0);
  }
}).catch(err => {
  console.error(err);
  process.exit(1);
});
