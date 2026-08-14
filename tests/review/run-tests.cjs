// Compatibility launcher for Firebase CLI standalone binaries that execute child
// Node scripts through a CommonJS/pkg wrapper. The actual test suite remains ESM.
(async () => {
  try {
    await import('./review_action.test.mjs');
    await import('./lifecycle.test.mjs');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
