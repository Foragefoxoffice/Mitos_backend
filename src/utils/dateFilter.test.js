const { buildDateFilterWhere } = require('./dateFilter');

// Fixed reference instant so every test is deterministic regardless of
// when it runs: 2026-09-15T09:28:14Z = IST midnight is 2026-09-14T18:30:00Z.
const now = new Date('2026-09-15T09:28:14.000Z');
const istMidnightToday = new Date('2026-09-14T18:30:00.000Z');

describe('buildDateFilterWhere', () => {
  it('returns null for a field outside the allowlist', () => {
    expect(buildDateFilterWhere({ field: 'password', condition: 'today', days: 1, now })).toBeNull();
  });

  it('returns null for an unrecognized condition', () => {
    expect(buildDateFilterWhere({ field: 'trialEndsAt', condition: 'whenever', days: 1, now })).toBeNull();
  });

  it('"today" matches the current IST calendar day only', () => {
    const where = buildDateFilterWhere({ field: 'trialEndsAt', condition: 'today', days: 1, now });
    expect(where).toEqual({
      trialEndsAt: { gte: istMidnightToday, lt: new Date('2026-09-15T18:30:00.000Z') },
    });
  });

  it('"in_next" is inclusive of today through N days ahead', () => {
    const where = buildDateFilterWhere({ field: 'trialEndsAt', condition: 'in_next', days: 3, now });
    expect(where).toEqual({
      trialEndsAt: { gte: istMidnightToday, lt: new Date('2026-09-18T18:30:00.000Z') },
    });
  });

  it('"expired_within" excludes today, covers the last N days strictly in the past', () => {
    const where = buildDateFilterWhere({ field: 'trialEndsAt', condition: 'expired_within', days: 3, now });
    expect(where).toEqual({
      trialEndsAt: { gte: new Date('2026-09-11T18:30:00.000Z'), lt: istMidnightToday },
    });
  });

  it('"exactly_days_ago" with days=0 matches today only (Day 1 of a trial that started today)', () => {
    const where = buildDateFilterWhere({ field: 'trialStartedAt', condition: 'exactly_days_ago', days: 0, now });
    expect(where).toEqual({
      trialStartedAt: { gte: istMidnightToday, lt: new Date('2026-09-15T18:30:00.000Z') },
    });
  });

  it('"exactly_days_ago" with days=6 matches a single day exactly a week back (Day 7 of trial)', () => {
    const where = buildDateFilterWhere({ field: 'trialStartedAt', condition: 'exactly_days_ago', days: 6, now });
    expect(where).toEqual({
      trialStartedAt: { gte: new Date('2026-09-08T18:30:00.000Z'), lt: new Date('2026-09-09T18:30:00.000Z') },
    });
  });

  it('"exactly_days_ago" never matches more than one calendar day, unlike expired_within', () => {
    const where = buildDateFilterWhere({ field: 'trialStartedAt', condition: 'exactly_days_ago', days: 6, now });
    const spanMs = where.trialStartedAt.lt.getTime() - where.trialStartedAt.gte.getTime();
    expect(spanMs).toBe(24 * 60 * 60 * 1000);
  });
});
