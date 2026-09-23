const { buildPhoneNumberLookupCandidates } = require('./phoneNumberLookup');

describe('buildPhoneNumberLookupCandidates', () => {
  it('builds the digits-only and +-prefixed forms for a 12-digit Indian number', () => {
    expect(buildPhoneNumberLookupCandidates('919913087772')).toEqual([
      '919913087772',
      '+919913087772',
      '9913087772',
    ]);
  });

  it('does not add a bare-10-digit candidate for a non-91 or wrong-length number', () => {
    expect(buildPhoneNumberLookupCandidates('12025550123')).toEqual(['12025550123', '+12025550123']);
    expect(buildPhoneNumberLookupCandidates('9913087772')).toEqual(['9913087772', '+9913087772']);
  });

  it('strips non-digit characters before building candidates', () => {
    expect(buildPhoneNumberLookupCandidates('+91 99130-87772')).toEqual([
      '919913087772',
      '+919913087772',
      '9913087772',
    ]);
  });

  it('returns an empty array for empty or missing input', () => {
    expect(buildPhoneNumberLookupCandidates('')).toEqual([]);
    expect(buildPhoneNumberLookupCandidates(null)).toEqual([]);
    expect(buildPhoneNumberLookupCandidates(undefined)).toEqual([]);
  });
});
