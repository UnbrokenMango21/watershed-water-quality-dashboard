// Keep Storage lifecycle hooks isolated from the Firestore rules suite.
(async () => {
  try {
    await import('./storage.rules.test.mjs');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
