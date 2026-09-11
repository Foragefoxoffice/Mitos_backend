const { buildAlreadyNotifiedWhere } = require('./notificationDedupe');

describe('buildAlreadyNotifiedWhere', () => {
  const now = new Date('2026-09-11T00:00:00.000Z');

  it('matches on userId + exact message text regardless of window', () => {
    const where = buildAlreadyNotifiedWhere({ userIds: [1, 2], message: 'hi', windowDays: 7, now });
    expect(where.userId).toEqual({ in: [1, 2] });
    expect(where.message).toBe('hi');
  });

  it('adds a createdAt cutoff N days back when windowDays is positive', () => {
    const where = buildAlreadyNotifiedWhere({ userIds: [1], message: 'hi', windowDays: 7, now });
    expect(where.createdAt).toEqual({ gte: new Date('2026-09-04T00:00:00.000Z') });
  });

  it('omits the createdAt filter (matches forever) when windowDays is 0', () => {
    const where = buildAlreadyNotifiedWhere({ userIds: [1], message: 'hi', windowDays: 0, now });
    expect(where.createdAt).toBeUndefined();
  });

  it('omits the createdAt filter when windowDays is negative', () => {
    const where = buildAlreadyNotifiedWhere({ userIds: [1], message: 'hi', windowDays: -5, now });
    expect(where.createdAt).toBeUndefined();
  });

  it('defaults now to the current time when not provided', () => {
    const before = Date.now();
    const where = buildAlreadyNotifiedWhere({ userIds: [1], message: 'hi', windowDays: 1 });
    const after = Date.now();
    expect(where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000);
    expect(where.createdAt.gte.getTime()).toBeLessThanOrEqual(after - 24 * 60 * 60 * 1000);
  });
});
