const { buildUserSearchWhere } = require('./salesRecipientSearch');

describe('buildUserSearchWhere', () => {
  it('returns null for a blank query', () => {
    expect(buildUserSearchWhere('   ')).toBeNull();
    expect(buildUserSearchWhere(undefined)).toBeNull();
  });

  it('builds an OR search across name, email, and phone', () => {
    expect(buildUserSearchWhere('  priya  ')).toEqual({
      OR: [
        { name: { contains: 'priya' } },
        { email: { contains: 'priya' } },
        { phoneNumber: { contains: 'priya' } },
      ],
    });
  });
});
