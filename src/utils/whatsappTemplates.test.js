const { parseTemplateComponents, countBodyVariables } = require('./whatsappTemplates');

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
      headerText: '',
      bodyText:
        "Your login code is {{1}}. No further action is needed if you didn't request this. For your security, do not share this code.",
      bodyVariableCount: 1,
      footerText: 'Expires in 15 minutes.',
      buttons: [{ type: 'URL', text: 'Copy code' }],
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
      { type: 'QUICK_REPLY', text: 'NEET 2027' },
      { type: 'QUICK_REPLY', text: 'NEET 2028' },
    ]);
  });

  it('handles missing/empty components gracefully', () => {
    expect(parseTemplateComponents(undefined)).toEqual({
      headerText: '',
      bodyText: '',
      bodyVariableCount: 0,
      footerText: '',
      buttons: [],
    });
  });
});
