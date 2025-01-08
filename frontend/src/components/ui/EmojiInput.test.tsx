import { describe, it, expect } from 'vitest';
import { isOneEmoji } from './EmojiInput';

describe('isOneEmoji', () => {
  const testCases = [
    { input: 'a', expected: false, description: 'regular single text' },
    { input: 'asdfasdf', expected: false, description: 'regular text' },
    { input: '💪', expected: true, description: 'single emoji (flexed biceps)' },
    { input: '💪💪', expected: false, description: 'multiple same emojis' },
    { input: '🏋️', expected: true, description: 'single emoji with variation selector (weight lifter)' },
    { input: '✅', expected: true, description: 'single emoji (check mark)' },
    { input: '⚠️', expected: true, description: 'single emoji with variation selector (warning)' },
    { input: '⚠️⚠️', expected: false, description: 'multiple warning emojis' },
    // Additional edge cases
    { input: '', expected: false, description: 'empty string' },
    { input: '👨‍👩‍👧‍👦', expected: true, description: 'family emoji with ZWJ sequences' },
    { input: '👍🏽', expected: true, description: 'emoji with skin tone modifier' },
  ];

  testCases.forEach(({ input, expected, description }) => {
    it(`should return ${expected} for ${description}`, () => {
      expect(isOneEmoji(input)).toBe(expected);
    });
  });
}); 