const { sendInBatches } = require('./batch');

describe('sendInBatches', () => {
  it('preserves item order and count in the results', async () => {
    const results = await sendInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('never runs more than batchSize workers concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 11 }, (_, i) => i);
    await sendInBatches(items, 3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('handles an empty item list', async () => {
    const results = await sendInBatches([], 5, async (n) => n);
    expect(results).toEqual([]);
  });

  it('handles a batchSize larger than the item list', async () => {
    const results = await sendInBatches([1, 2], 100, async (n) => n);
    expect(results).toEqual([1, 2]);
  });
});
