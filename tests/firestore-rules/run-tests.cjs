// Compatibility launcher for Firebase CLI standalone binaries that execute child
// Node scripts through a CommonJS/pkg wrapper. The actual test suite remains ESM.
(async () => {
  try {
    await import('./firestore.rules.test.mjs');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
