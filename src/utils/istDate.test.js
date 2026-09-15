const { istTodayStart } = require('./istDate');

describe('istTodayStart', () => {
  it('returns the UTC instant of IST midnight for an instant late in the IST day', () => {
    // 2026-09-16T18:52:12Z = 2026-09-17T00:22:12 IST -> IST midnight that day is 2026-09-16T18:30:00Z
    const now = new Date('2026-09-16T18:52:12.468Z');
    expect(istTodayStart(now)).toEqual(new Date('2026-09-16T18:30:00.000Z'));
  });

  it('returns the same IST midnight for an instant just before it', () => {
    // 2026-09-16T18:29:59Z = 2026-09-16T23:59:59 IST -> still the same IST calendar day as above
    const now = new Date('2026-09-16T18:29:59.000Z');
    expect(istTodayStart(now)).toEqual(new Date('2026-09-15T18:30:00.000Z'));
  });

  it('is independent of the executing process\'s local timezone (pure UTC arithmetic)', () => {
    const now = new Date('2026-09-15T09:28:14.314Z');
    // IST wall-clock for this instant is 2026-09-15T14:58:14 -> IST midnight is 2026-09-14T18:30:00Z
    expect(istTodayStart(now)).toEqual(new Date('2026-09-14T18:30:00.000Z'));
  });
});
