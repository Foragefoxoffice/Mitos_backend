const {
  MAX_CAMPAIGN_RECIPIENTS,
  buildCampaignDedupeWhere,
  validateCampaignRecipients,
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

describe('buildTemplateBodyComponents', () => {
  it('returns no components when the template has no variables', () => {
    expect(buildTemplateBodyComponents({ bodyVariableCount: 0, recipientName: 'Priya' })).toEqual([]);
  });

  it('fills a single variable with the recipient name', () => {
    expect(buildTemplateBodyComponents({ bodyVariableCount: 1, recipientName: 'Priya' })).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Priya' }] },
    ]);
  });

  it('falls back to "there" when no recipient name is known', () => {
    expect(buildTemplateBodyComponents({ bodyVariableCount: 1, recipientName: null })).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'there' }] },
    ]);
  });

  it('throws for more than one body variable', () => {
    expect(() => buildTemplateBodyComponents({ bodyVariableCount: 2, recipientName: 'Priya' })).toThrow(
      'Templates with more than one body variable are not supported yet'
    );
  });
});
