const {
  MAX_CAMPAIGN_RECIPIENTS,
  buildCampaignDedupeWhere,
  validateCampaignRecipients,
  VARIABLE_FIELD_OPTIONS,
  VALID_VARIABLE_FIELDS,
  formatDateValue,
  resolveTemplateVariableValue,
  validateVariableMappings,
  buildTemplateBodyComponents,
} = require('./salesCampaignHelpers');

describe('buildCampaignDedupeWhere', () => {
  it('builds a windowed where clause by default', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    expect(buildCampaignDedupeWhere({ phoneNumber: '916379034696', templateName: 'neet_opener', now })).toEqual({
      conversation: { phoneNumber: '916379034696' },
      messageType: 'template',
      text: '[template:neet_opener]',
      createdAt: { gte: new Date('2026-09-08T00:00:00.000Z') },
    });
  });

  it('omits the time window when windowDays is 0', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    expect(
      buildCampaignDedupeWhere({ phoneNumber: '916379034696', templateName: 'neet_opener', windowDays: 0, now })
    ).toEqual({
      conversation: { phoneNumber: '916379034696' },
      messageType: 'template',
      text: '[template:neet_opener]',
    });
  });
});

describe('validateCampaignRecipients', () => {
  it('rejects an empty list', () => {
    expect(validateCampaignRecipients([])).toEqual({ valid: false, error: 'At least one recipient is required' });
  });

  it('rejects more than 100 recipients', () => {
    const recipients = Array.from({ length: 101 }, (_, i) => ({ phoneNumber: `9${i}` }));
    expect(validateCampaignRecipients(recipients)).toEqual({
      valid: false,
      error: 'Cannot send to more than 100 recipients per campaign',
    });
  });

  it('accepts up to 100 recipients', () => {
    const recipients = Array.from({ length: 100 }, (_, i) => ({ phoneNumber: `9${i}` }));
    expect(validateCampaignRecipients(recipients)).toEqual({ valid: true });
  });

  it('exposes the cap as a constant', () => {
    expect(MAX_CAMPAIGN_RECIPIENTS).toBe(100);
  });
});

describe('formatDateValue', () => {
  it('formats a date as D MMM YYYY', () => {
    expect(formatDateValue(new Date('2026-09-05T10:00:00.000Z'))).toBe('5 Sep 2026');
  });

  it('returns null for a missing value', () => {
    expect(formatDateValue(null)).toBeNull();
    expect(formatDateValue(undefined)).toBeNull();
  });

  it('returns null for an invalid date', () => {
    expect(formatDateValue('not-a-date')).toBeNull();
  });
});

describe('resolveTemplateVariableValue', () => {
  it("defaults to the user's name", () => {
    expect(resolveTemplateVariableValue({ field: 'name', userRecord: { name: 'Priya' } })).toBe('Priya');
  });

  it('falls back to name for an unrecognized field', () => {
    expect(resolveTemplateVariableValue({ field: 'bogus', userRecord: { name: 'Priya' } })).toBe('Priya');
  });

  it('maps className to a readable label', () => {
    expect(resolveTemplateVariableValue({ field: 'className', userRecord: { className: 'CLASS_11' } })).toBe('Class 11');
    expect(resolveTemplateVariableValue({ field: 'className', userRecord: { className: 'REPEATER' } })).toBe('Repeater');
  });

  it('returns null for className when the user has none set', () => {
    expect(resolveTemplateVariableValue({ field: 'className', userRecord: {} })).toBeNull();
  });

  it('returns the phone number', () => {
    expect(resolveTemplateVariableValue({ field: 'phoneNumber', userRecord: { phoneNumber: '916379034696' } })).toBe(
      '916379034696'
    );
  });

  it('formats trialStartedAt, trialEndsAt, and premiumExpiry', () => {
    const userRecord = {
      trialStartedAt: new Date('2026-09-01T00:00:00.000Z'),
      trialEndsAt: new Date('2026-09-11T00:00:00.000Z'),
      premiumExpiry: new Date('2027-09-11T00:00:00.000Z'),
    };
    expect(resolveTemplateVariableValue({ field: 'trialStartedAt', userRecord })).toBe('1 Sep 2026');
    expect(resolveTemplateVariableValue({ field: 'trialEndsAt', userRecord })).toBe('11 Sep 2026');
    expect(resolveTemplateVariableValue({ field: 'premiumExpiry', userRecord })).toBe('11 Sep 2027');
  });

  it('formats currentDate using the provided now', () => {
    const now = new Date('2026-09-16T00:00:00.000Z');
    expect(resolveTemplateVariableValue({ field: 'currentDate', userRecord: {}, now })).toBe('16 Sep 2026');
  });

  it('uses the fixed custom value regardless of the user record', () => {
    expect(
      resolveTemplateVariableValue({ field: 'custom', customValue: 'NEET Aspirant', userRecord: { name: 'Priya' } })
    ).toBe('NEET Aspirant');
  });

  it('returns null for custom when no custom value was given', () => {
    expect(resolveTemplateVariableValue({ field: 'custom', userRecord: {} })).toBeNull();
  });
});

describe('validateVariableMappings', () => {
  it('is valid when the template has no variables', () => {
    expect(validateVariableMappings({ bodyVariableCount: 0, variableMappings: [] })).toEqual({ valid: true });
  });

  it('rejects a mapping count that does not match the template', () => {
    expect(validateVariableMappings({ bodyVariableCount: 2, variableMappings: [{ field: 'name' }] })).toEqual({
      valid: false,
      error: 'This template needs 2 variable mapping(s)',
    });
  });

  it('rejects an unrecognized field', () => {
    expect(validateVariableMappings({ bodyVariableCount: 1, variableMappings: [{ field: 'bogus' }] })).toEqual({
      valid: false,
      error: 'Invalid variable field selected',
    });
  });

  it('rejects a custom mapping with no value', () => {
    expect(
      validateVariableMappings({ bodyVariableCount: 1, variableMappings: [{ field: 'custom', customValue: '  ' }] })
    ).toEqual({ valid: false, error: 'Enter a value for each fixed-text variable' });
  });

  it('accepts a valid multi-variable mapping', () => {
    expect(
      validateVariableMappings({
        bodyVariableCount: 2,
        variableMappings: [{ field: 'name' }, { field: 'trialEndsAt' }],
      })
    ).toEqual({ valid: true });
  });
});

describe('VARIABLE_FIELD_OPTIONS / VALID_VARIABLE_FIELDS', () => {
  it('keeps the two in sync', () => {
    expect(VALID_VARIABLE_FIELDS).toEqual(VARIABLE_FIELD_OPTIONS.map((o) => o.value));
  });

  it('includes all the expected fields', () => {
    expect(VALID_VARIABLE_FIELDS).toEqual(
      expect.arrayContaining([
        'name',
        'className',
        'phoneNumber',
        'trialStartedAt',
        'trialEndsAt',
        'premiumExpiry',
        'currentDate',
        'custom',
      ])
    );
  });
});

describe('buildTemplateBodyComponents', () => {
  it('returns no components when the template has no variables', () => {
    expect(buildTemplateBodyComponents({ bodyVariableCount: 0, variableValues: [] })).toEqual([]);
  });

  it('builds one parameter per variable, in order', () => {
    expect(buildTemplateBodyComponents({ bodyVariableCount: 2, variableValues: ['Priya', '11 Sep 2026'] })).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Priya' }, { type: 'text', text: '11 Sep 2026' }] },
    ]);
  });

  it('falls back to "there" for any missing value', () => {
    expect(buildTemplateBodyComponents({ bodyVariableCount: 2, variableValues: ['Priya'] })).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Priya' }, { type: 'text', text: 'there' }] },
    ]);
  });
});
