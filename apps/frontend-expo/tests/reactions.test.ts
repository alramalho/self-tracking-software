import test from "node:test";
import assert from "node:assert/strict";
import {
  isReactionEmoji,
  normalizeReactionEmojiInput,
  REACTION_EMOJI_CATEGORIES,
} from "@tsw/prisma/reactions";

test("a reaction is exactly one complete emoji, with or without Intl.Segmenter", () => {
  for (const emoji of ["🔥", "👍🏽", "🇵🇹", "🏃‍♀️", "1️⃣", "❤️", "⚡️"]) {
    assert.equal(isReactionEmoji(emoji), true, emoji);
  }
  for (const input of ["😀😀", "🔥‍🔥", "🔥a", "a🔥", "12", "👍🏽👍🏽"]) {
    assert.equal(isReactionEmoji(input), false, input);
  }
});

test("the input keeps one emoji immediately after a paste or second keypress", () => {
  assert.equal(normalizeReactionEmojiInput("😀😀"), "😀");
  assert.equal(normalizeReactionEmojiInput("👍🏽👍🏽"), "👍🏽");
  assert.equal(normalizeReactionEmojiInput("🇵🇹🇺🇸"), "🇵🇹");
  assert.equal(normalizeReactionEmojiInput("🏃‍♀️🔥"), "🏃‍♀️");
  assert.equal(normalizeReactionEmojiInput("🔥a"), "🔥");
  assert.equal(normalizeReactionEmojiInput("a"), "");
});

test("all picker choices are valid individual reactions", () => {
  for (const category of REACTION_EMOJI_CATEGORIES) {
    for (const emoji of category.emojis) {
      assert.equal(isReactionEmoji(emoji), true, `${category.name}: ${emoji}`);
    }
  }
});
