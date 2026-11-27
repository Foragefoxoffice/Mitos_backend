const {
  normalizeContact,
  hashContact,
  maskContact,
  isContactBlocked,
  recordDeletedContacts,
  DELETED_CONTACT_ERROR,
} = require('./deletedContacts');

describe('hashContact / normalizeContact', () => {
  it('gives one hash for the same phone in different formats', () => {
    const formats = ['+919876543210', '9876543210', '98765 43210', '919876543210'];
    const hashes = formats.map((p) => hashContact('PHONE', p));
    expect(new Set(hashes).size).toBe(1);
    expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives one hash for an email regardless of case and spaces', () => {
    expect(hashContact('EMAIL', ' Foo@Gmail.com ')).toBe(hashContact('EMAIL', 'foo@gmail.com'));
  });

  it('keeps phone and email hashes apart', () => {
    expect(hashContact('PHONE', '9876543210')).not.toBe(hashContact('EMAIL', '9876543210'));
  });

  it('returns null for unusable values', () => {
    expect(hashContact('PHONE', '123')).toBeNull();
    expect(hashContact('PHONE', null)).toBeNull();
    expect(hashContact('EMAIL', '   ')).toBeNull();
    expect(normalizeContact('PHONE', '+91 98765-43210')).toBe('919876543210');
  });
});

describe('maskContact', () => {
  it('masks a phone', () => {
    expect(maskContact('PHONE', '+919876543210')).toBe('+91 98•••••210');
  });
  it('masks an email', () => {
    expect(maskContact('EMAIL', 'arun@gmail.com')).toBe('ar•••@gmail.com');
  });
});

describe('recordDeletedContacts', () => {
  const makeDb = () => ({ deleted_contact: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } });

  it('records only the phone when email is null', async () => {
    const db = makeDb();
    await recordDeletedContacts(db, { id: 1, phoneNumber: '+919876543210', email: null });
    const arg = db.deleted_contact.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toHaveLength(1);
    expect(arg.data[0]).toMatchObject({ type: 'PHONE', userId: 1, masked: '+91 98•••••210' });
    expect(arg.data[0].hash).toBe(hashContact('PHONE', '9876543210'));
  });

  it('records both contacts', async () => {
    const db = makeDb();
    await recordDeletedContacts(db, { id: 2, phoneNumber: '9876543210', email: 'a@b.com' });
    expect(db.deleted_contact.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('does nothing when the user has no contacts', async () => {
    const db = makeDb();
    await recordDeletedContacts(db, { id: 3, phoneNumber: null, email: null });
    expect(db.deleted_contact.createMany).not.toHaveBeenCalled();
  });
});

describe('isContactBlocked', () => {
  it('is true when a matching row exists', async () => {
    const db = { deleted_contact: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) } };
    await expect(isContactBlocked(db, { phone: '9876543210' })).resolves.toBe(true);
    const where = db.deleted_contact.findFirst.mock.calls[0][0].where;
    expect(where.hash.in).toEqual([hashContact('PHONE', '9876543210')]);
  });

  it('is false when no row exists', async () => {
    const db = { deleted_contact: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(isContactBlocked(db, { phone: '9876543210', email: 'a@b.com' })).resolves.toBe(false);
  });

  it('fails open when the table/client is missing (never blocks login)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(isContactBlocked({}, { phone: '9876543210' })).resolves.toBe(false);
    const db = { deleted_contact: { findFirst: jest.fn().mockRejectedValue(new Error("Table doesn't exist")) } };
    await expect(isContactBlocked(db, { email: 'a@b.com' })).resolves.toBe(false);
    spy.mockRestore();
  });

  it('skips the query when no contact is given', async () => {
    const db = { deleted_contact: { findFirst: jest.fn() } };
    await expect(isContactBlocked(db, {})).resolves.toBe(false);
    expect(db.deleted_contact.findFirst).not.toHaveBeenCalled();
  });
});

describe('DELETED_CONTACT_ERROR', () => {
  it('has the agreed code and message', () => {
    expect(DELETED_CONTACT_ERROR.code).toBe('ACCOUNT_DELETED');
    expect(DELETED_CONTACT_ERROR.message).toBe(
      "This account was deleted. This phone number/email can't be used to create a new account. Contact support@mitoslearning.in if you think this is a mistake."
    );
  });
});
