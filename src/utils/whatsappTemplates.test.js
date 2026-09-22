const { parseTemplateComponents, countBodyVariables, hasDynamicUrl } = require('./whatsappTemplates');

describe('countBodyVariables', () => {
  it('counts distinct {{n}} placeholders', () => {
    expect(countBodyVariables('Hi {{1}}, your code is {{2}}.')).toBe(2);
  });

  it('returns 0 for plain text', () => {
    expect(countBodyVariables('Welcome and congratulations!!')).toBe(0);
  });

  it('deduplicates a repeated placeholder', () => {
    expect(countBodyVariables('{{1}} and {{1}} again')).toBe(1);
  });
});

describe('parseTemplateComponents', () => {
  it('parses a template with a body variable, footer, and URL button (real login_otp shape)', () => {
    const components = [
      {
        type: 'BODY',
        text: "Your login code is {{1}}. No further action is needed if you didn't request this. For your security, do not share this code.",
        example: { body_text: [['123']] },
      },
      { type: 'FOOTER', text: 'Expires in 15 minutes.' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Copy code', url: 'https://www.whatsapp.com/otp/code/' }],
      },
    ];
    expect(parseTemplateComponents(components)).toEqual({
      headerFormat: null,
      headerText: '',
      bodyText:
        "Your login code is {{1}}. No further action is needed if you didn't request this. For your security, do not share this code.",
      bodyVariableCount: 1,
      footerText: 'Expires in 15 minutes.',
      buttons: [{ type: 'URL', text: 'Copy code', hasDynamicUrl: false }],
    });
  });

  it('parses a template with a header and no buttons (real hello_world shape)', () => {
    const components = [
      { type: 'HEADER', format: 'TEXT', text: 'Hello World' },
      {
        type: 'BODY',
        text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.',
      },
      { type: 'FOOTER', text: 'WhatsApp Business Platform sample message' },
    ];
    expect(parseTemplateComponents(components)).toEqual({
      headerFormat: 'TEXT',
      headerText: 'Hello World',
      bodyText:
        'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.',
      bodyVariableCount: 0,
      footerText: 'WhatsApp Business Platform sample message',
      buttons: [],
    });
  });

  it('parses quick-reply buttons', () => {
    const components = [
      { type: 'BODY', text: 'Are you preparing for NEET 2027 or 2028?' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'NEET 2027' },
          { type: 'QUICK_REPLY', text: 'NEET 2028' },
        ],
      },
    ];
    expect(parseTemplateComponents(components).buttons).toEqual([
      { type: 'QUICK_REPLY', text: 'NEET 2027', hasDynamicUrl: false },
      { type: 'QUICK_REPLY', text: 'NEET 2028', hasDynamicUrl: false },
    ]);
  });

  it('handles missing/empty components gracefully', () => {
    expect(parseTemplateComponents(undefined)).toEqual({
      headerFormat: null,
      headerText: '',
      bodyText: '',
      bodyVariableCount: 0,
      footerText: '',
      buttons: [],
    });
  });

  it('flags a URL button with a dynamic placeholder', () => {
    const components = [
      { type: 'BODY', text: 'Check this out' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'View Offer', url: 'https://mitoslearning.com/promo/{{1}}' }] },
    ];
    expect(parseTemplateComponents(components).buttons).toEqual([
      { type: 'URL', text: 'View Offer', hasDynamicUrl: true },
    ]);
  });
});

describe('hasDynamicUrl', () => {
  it('detects a {{n}} placeholder in a URL', () => {
    expect(hasDynamicUrl('https://mitoslearning.com/promo/{{1}}')).toBe(true);
  });

  it('returns false for a static URL', () => {
    expect(hasDynamicUrl('https://mitoslearning.com/promo')).toBe(false);
  });

  it('returns false for a missing URL', () => {
    expect(hasDynamicUrl(undefined)).toBe(false);
    expect(hasDynamicUrl(null)).toBe(false);
  });
});
