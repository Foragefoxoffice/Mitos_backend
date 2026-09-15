const { isEligibleSender, shouldGenerateAiReply } = require('./salesReplyGate');

describe('isEligibleSender', () => {
  it('allows the owner when owner auto-reply is enabled', () => {
    expect(isEligibleSender({ isOwner: true, ownerAutoReplyEnabled: true, conversationExists: false })).toBe(true);
  });

  it('blocks the owner when owner auto-reply is disabled', () => {
    expect(isEligibleSender({ isOwner: true, ownerAutoReplyEnabled: false, conversationExists: true })).toBe(false);
  });

  it('allows a non-owner number with an existing conversation', () => {
    expect(isEligibleSender({ isOwner: false, ownerAutoReplyEnabled: true, conversationExists: true })).toBe(true);
  });

  it('blocks a non-owner number with no existing conversation', () => {
    expect(isEligibleSender({ isOwner: false, ownerAutoReplyEnabled: true, conversationExists: false })).toBe(false);
  });
});

describe('shouldGenerateAiReply', () => {
  it('replies when the conversation is active', () => {
    expect(shouldGenerateAiReply({ conversationStatus: 'ACTIVE' })).toBe(true);
  });

  it('does not reply when the conversation is paused', () => {
    expect(shouldGenerateAiReply({ conversationStatus: 'PAUSED' })).toBe(false);
  });

  it('replies when there is no conversation status yet', () => {
    expect(shouldGenerateAiReply({ conversationStatus: undefined })).toBe(true);
  });
});
