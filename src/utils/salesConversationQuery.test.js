const { buildConversationListWhere } = require('./salesConversationQuery');

describe('buildConversationListWhere', () => {
  it('returns an empty filter when nothing is provided', () => {
    expect(buildConversationListWhere({})).toEqual({});
  });

  it('filters by userId when a valid numeric id is given', () => {
    expect(buildConversationListWhere({ userId: '42' })).toEqual({ userId: 42 });
  });

  it('ignores a non-numeric userId', () => {
    expect(buildConversationListWhere({ userId: 'abc' })).toEqual({});
  });

  it('filters by lead stage', () => {
    expect(buildConversationListWhere({ stage: 'QUALIFIED' })).toEqual({
      lead: { stage: 'QUALIFIED' },
    });
  });

  it('builds an OR search across phone, user name, and user email', () => {
    expect(buildConversationListWhere({ search: '  9876543210  ' })).toEqual({
      OR: [
        { phoneNumber: { contains: '9876543210' } },
        { user: { name: { contains: '9876543210' } } },
        { user: { email: { contains: '9876543210' } } },
      ],
    });
  });

  it('ignores a blank search string', () => {
    expect(buildConversationListWhere({ search: '   ' })).toEqual({});
  });

  it('filters by needsHuman when true (boolean or string)', () => {
    expect(buildConversationListWhere({ needsHuman: true })).toEqual({ needsHuman: true });
    expect(buildConversationListWhere({ needsHuman: 'true' })).toEqual({ needsHuman: true });
  });

  it('ignores needsHuman when false or absent', () => {
    expect(buildConversationListWhere({ needsHuman: false })).toEqual({});
    expect(buildConversationListWhere({})).toEqual({});
  });

  it('combines userId, stage, and search together', () => {
    expect(
      buildConversationListWhere({ userId: '7', stage: 'REPLIED', search: 'priya' })
    ).toEqual({
      userId: 7,
      lead: { stage: 'REPLIED' },
      OR: [
        { phoneNumber: { contains: 'priya' } },
        { user: { name: { contains: 'priya' } } },
        { user: { email: { contains: 'priya' } } },
      ],
    });
  });
});
