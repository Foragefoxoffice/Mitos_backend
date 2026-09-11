// Runs `worker` over `items`, batchSize at a time — each batch is fully
// awaited (Promise.all) before the next one starts, so at most batchSize
// operations are ever in flight simultaneously. Built for
// notificationController.js's FCM fan-out: production runs the backend as
// a single PM2 fork-mode process with a 500MB memory cap
// (ecosystem.config.js) — firing thousands of concurrent
// admin.messaging().send() calls in one unbounded Promise.all exhausted
// that and got the whole process OOM-killed/restarted mid-request,
// surfacing to the admin panel as a 502 (confirmed live 2026-09-11 on a
// ~16k-recipient send). Bounding concurrency keeps memory flat regardless
// of recipient count, at the cost of wall-clock time for very large sends.
async function sendInBatches(items, batchSize, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }
  return results;
}

module.exports = { sendInBatches };
