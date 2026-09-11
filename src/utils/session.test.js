const { hasSessionConflict, isSessionEnforced } = require('./session');

describe('isSessionEnforced', () => {
  it('is enforced for a regular user', () => {
    expect(isSessionEnforced('user')).toBe(true);
  });

  it('is NOT enforced for an admin', () => {
    expect(isSessionEnforced('admin')).toBe(false);
  });
});

describe('hasSessionConflict', () => {
  const otherDeviceUser = { role: 'user', activeSessionDeviceId: 'device-A' };
  const adminOtherDeviceUser = { role: 'admin', activeSessionDeviceId: 'device-A' };

  it('flags a conflict for a regular user logging in from a different device', () => {
    expect(hasSessionConflict(otherDeviceUser, { deviceId: 'device-B' })).toBe(true);
  });

  it('does not flag a conflict for the same device', () => {
    expect(hasSessionConflict(otherDeviceUser, { deviceId: 'device-A' })).toBe(false);
  });

  it('does not flag a conflict when force is set', () => {
    expect(hasSessionConflict(otherDeviceUser, { deviceId: 'device-B', force: true })).toBe(false);
  });

  it('never flags a conflict for an admin, even from a different device with no force', () => {
    expect(hasSessionConflict(adminOtherDeviceUser, { deviceId: 'device-B' })).toBe(false);
  });

  it('has no conflict when there is no prior active device', () => {
    expect(hasSessionConflict({ role: 'user', activeSessionDeviceId: null }, { deviceId: 'device-B' })).toBe(false);
  });
});
