const { splitReplyIntoMessages, typingDelayForChunk, MAX_MESSAGE_CHUNKS } = require('./salesReplyChunking');

describe('splitReplyIntoMessages', () => {
  it('returns a single-element array for a reply with no blank lines', () => {
    expect(splitReplyIntoMessages('Hey, how can I help?')).toEqual(['Hey, how can I help?']);
  });

  it('splits on blank lines into separate bubbles', () => {
    expect(splitReplyIntoMessages('First part.\n\nSecond part.\n\nThird part.')).toEqual([
      'First part.',
      'Second part.',
      'Third part.',
    ]);
  });

  it('trims each chunk and drops empty ones from extra blank lines', () => {
    expect(splitReplyIntoMessages('  First.  \n\n\n\n  Second.  ')).toEqual(['First.', 'Second.']);
  });

  it('returns an empty array for empty or missing input', () => {
    expect(splitReplyIntoMessages('')).toEqual([]);
    expect(splitReplyIntoMessages(null)).toEqual([]);
    expect(splitReplyIntoMessages(undefined)).toEqual([]);
  });

  it('caps the number of bubbles, folding overflow into the last one', () => {
    const paragraphs = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const result = splitReplyIntoMessages(paragraphs.join('\n\n'));
    expect(result).toHaveLength(MAX_MESSAGE_CHUNKS);
    expect(result[0]).toBe('One');
    expect(result[MAX_MESSAGE_CHUNKS - 1]).toBe('Four\n\nFive\n\nSix');
  });
});

describe('typingDelayForChunk', () => {
  it('never goes below the minimum delay for very short text', () => {
    expect(typingDelayForChunk('Hi')).toBe(500);
  });

  it('never exceeds the maximum delay for very long text', () => {
    expect(typingDelayForChunk('x'.repeat(500))).toBe(2200);
  });

  it('scales with text length in between the bounds', () => {
    expect(typingDelayForChunk('x'.repeat(50))).toBe(900);
  });
});
