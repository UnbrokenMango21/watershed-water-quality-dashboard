(async () => {
  try {
    await import('./firestore_adapter.test.mjs');
    await import('./orchestrator.test.mjs');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
