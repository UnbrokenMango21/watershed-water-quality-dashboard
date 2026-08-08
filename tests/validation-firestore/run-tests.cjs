(async () => {
  try {
    await import('./firestore_adapter.test.mjs');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
