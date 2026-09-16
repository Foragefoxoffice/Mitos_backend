const { buildRecipientCandidateWhere } = require('./salesRecipientCandidates');

describe('buildRecipientCandidateWhere', () => {
  it('returns null when filterType is missing or unrecognized', () => {
    expect(buildRecipientCandidateWhere({})).toBeNull();
    expect(buildRecipientCandidateWhere({ filterType: 'bogus' })).toBeNull();
  });

  it('returns null for a status filter with no status given', () => {
    expect(buildRecipientCandidateWhere({ filterType: 'status' })).toBeNull();
  });

  it('builds a status filter, excluding DELETED and already-contacted users by default', () => {
    const where = buildRecipientCandidateWhere({ filterType: 'status', status: 'TRIALED' });
    expect(where).toEqual({
      AND: [
        { phoneNumber: { not: null } },
        { status: { not: 'DELETED' } },
        { status: 'TRIALED' },
        { whatsappConversations: { none: {} } },
      ],
    });
  });

  it('omits the already-contacted exclusion when includeContacted is true', () => {
    const where = buildRecipientCandidateWhere({ filterType: 'status', status: 'PREMIUM', includeContacted: true });
    expect(where).toEqual({
      AND: [
        { phoneNumber: { not: null } },
        { status: { not: 'DELETED' } },
        { status: 'PREMIUM' },
      ],
    });
  });

  it('builds a date filter using buildDateFilterWhere', () => {
    const now = new Date('2026-09-15T09:28:14.000Z');
    const where = buildRecipientCandidateWhere({
      filterType: 'date',
      field: 'trialEndsAt',
      condition: 'in_next',
      days: 3,
      now,
    });
    expect(where).toEqual({
      AND: [
        { phoneNumber: { not: null } },
        { status: { not: 'DELETED' } },
        { trialEndsAt: { gte: new Date('2026-09-14T18:30:00.000Z'), lt: new Date('2026-09-18T18:30:00.000Z') } },
        { whatsappConversations: { none: {} } },
      ],
    });
  });

  it('returns null when the date filter itself is invalid', () => {
    expect(buildRecipientCandidateWhere({ filterType: 'date', field: 'bogusField', condition: 'today' })).toBeNull();
  });
});
