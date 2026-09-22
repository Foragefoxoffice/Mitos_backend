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
  templateHasCopyCodeButton,
  buildCouponCodeButtonComponent,
  findCopyCodeButtonIndex,
  findDynamicUrlButtonIndex,
  templateHasDynamicUrlButton,
  buildUrlButtonComponent,
  templateNeedsHeaderMedia,
  buildTemplateHeaderComponent,
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

  it('returns the Mark Booster weakest chapter from the linked analytics summary', () => {
    expect(
      resolveTemplateVariableValue({
        field: 'weakestChapter',
        userRecord: { useranalyticssummary: { weakestChapter: 'Human Physiology' } },
      })
    ).toBe('Human Physiology');
  });

  it('returns null for weakestChapter when no analytics summary exists', () => {
    expect(resolveTemplateVariableValue({ field: 'weakestChapter', userRecord: {} })).toBeNull();
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

describe('templateHasCopyCodeButton', () => {
  it('returns true when a COPY_CODE button is present', () => {
    expect(templateHasCopyCodeButton({ buttons: [{ type: 'COPY_CODE', text: 'Copy offer code' }] })).toBe(true);
  });

  it('returns false when there are no buttons', () => {
    expect(templateHasCopyCodeButton({ buttons: [] })).toBe(false);
    expect(templateHasCopyCodeButton({})).toBe(false);
  });

  it('returns false when buttons exist but none are COPY_CODE', () => {
    expect(templateHasCopyCodeButton({ buttons: [{ type: 'QUICK_REPLY', text: 'NEET 2027' }] })).toBe(false);
  });
});

describe('buildCouponCodeButtonComponent', () => {
  it('returns null when no coupon code is given', () => {
    expect(buildCouponCodeButtonComponent(null)).toBeNull();
    expect(buildCouponCodeButtonComponent(undefined)).toBeNull();
    expect(buildCouponCodeButtonComponent('')).toBeNull();
  });

  it('builds the exact WhatsApp button component shape', () => {
    expect(buildCouponCodeButtonComponent('MITOSAI17')).toEqual({
      type: 'button',
      sub_type: 'copy_code',
      index: '0',
      parameters: [{ type: 'coupon_code', coupon_code: 'MITOSAI17' }],
    });
  });

  it('uses a custom index when given one', () => {
    expect(buildCouponCodeButtonComponent('MITOSAI17', 2)).toEqual({
      type: 'button',
      sub_type: 'copy_code',
      index: '2',
      parameters: [{ type: 'coupon_code', coupon_code: 'MITOSAI17' }],
    });
  });
});

describe('findCopyCodeButtonIndex / findDynamicUrlButtonIndex', () => {
  it('finds a COPY_CODE button index', () => {
    expect(findCopyCodeButtonIndex({ buttons: [{ type: 'QUICK_REPLY' }, { type: 'COPY_CODE' }] })).toBe(1);
  });

  it('returns -1 when no COPY_CODE button exists', () => {
    expect(findCopyCodeButtonIndex({ buttons: [{ type: 'QUICK_REPLY' }] })).toBe(-1);
    expect(findCopyCodeButtonIndex({})).toBe(-1);
  });

  it('finds a dynamic URL button index, ignoring a static one', () => {
    expect(
      findDynamicUrlButtonIndex({
        buttons: [
          { type: 'URL', hasDynamicUrl: false },
          { type: 'URL', hasDynamicUrl: true },
        ],
      })
    ).toBe(1);
  });

  it('returns -1 when there is no dynamic URL button', () => {
    expect(findDynamicUrlButtonIndex({ buttons: [{ type: 'URL', hasDynamicUrl: false }] })).toBe(-1);
  });
});

describe('templateHasDynamicUrlButton', () => {
  it('is true when a dynamic URL button exists', () => {
    expect(templateHasDynamicUrlButton({ buttons: [{ type: 'URL', hasDynamicUrl: true }] })).toBe(true);
  });

  it('is false otherwise', () => {
    expect(templateHasDynamicUrlButton({ buttons: [{ type: 'URL', hasDynamicUrl: false }] })).toBe(false);
    expect(templateHasDynamicUrlButton({})).toBe(false);
  });
});

describe('buildUrlButtonComponent', () => {
  it('returns null when the value or index is missing', () => {
    expect(buildUrlButtonComponent(null, 0)).toBeNull();
    expect(buildUrlButtonComponent('', 0)).toBeNull();
    expect(buildUrlButtonComponent('promo123', -1)).toBeNull();
    expect(buildUrlButtonComponent('promo123', null)).toBeNull();
  });

  it('builds the exact WhatsApp URL button component shape', () => {
    expect(buildUrlButtonComponent('promo123', 1)).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '1',
      parameters: [{ type: 'text', text: 'promo123' }],
    });
  });
});

describe('templateNeedsHeaderMedia', () => {
  it('is true for IMAGE/VIDEO/DOCUMENT headers', () => {
    expect(templateNeedsHeaderMedia({ headerFormat: 'IMAGE' })).toBe(true);
    expect(templateNeedsHeaderMedia({ headerFormat: 'VIDEO' })).toBe(true);
    expect(templateNeedsHeaderMedia({ headerFormat: 'DOCUMENT' })).toBe(true);
  });

  it('is false for TEXT or no header', () => {
    expect(templateNeedsHeaderMedia({ headerFormat: 'TEXT' })).toBe(false);
    expect(templateNeedsHeaderMedia({ headerFormat: null })).toBe(false);
    expect(templateNeedsHeaderMedia({})).toBe(false);
  });
});

describe('buildTemplateHeaderComponent', () => {
  it('returns null when the format is not media or the URL is missing', () => {
    expect(buildTemplateHeaderComponent('TEXT', 'https://example.com/a.jpg')).toBeNull();
    expect(buildTemplateHeaderComponent('IMAGE', null)).toBeNull();
    expect(buildTemplateHeaderComponent('IMAGE', '')).toBeNull();
  });

  it('builds the exact WhatsApp header component shape per media type', () => {
    expect(buildTemplateHeaderComponent('IMAGE', 'https://example.com/a.jpg')).toEqual({
      type: 'header',
      parameters: [{ type: 'image', image: { link: 'https://example.com/a.jpg' } }],
    });
    expect(buildTemplateHeaderComponent('VIDEO', 'https://example.com/a.mp4')).toEqual({
      type: 'header',
      parameters: [{ type: 'video', video: { link: 'https://example.com/a.mp4' } }],
    });
    expect(buildTemplateHeaderComponent('DOCUMENT', 'https://example.com/a.pdf')).toEqual({
      type: 'header',
      parameters: [{ type: 'document', document: { link: 'https://example.com/a.pdf' } }],
    });
  });
});
