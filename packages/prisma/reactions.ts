import emojiRegex from "emoji-regex/RGI_Emoji";

export const DEFAULT_REACTION_EMOJIS = ["🔥", "🚀", "♥️", "😂", "😮‍💨", "🍑"] as const;

export const MAX_REACTION_EMOJIS = 6;

// Common reactions are browsable here; the keyboard still supports other emoji.
export const REACTION_EMOJI_CATEGORIES = [
  { name: "Faces", emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊", "😍", "🥰", "😘", "😋", "😎", "🤩", "🥳", "😏", "😌", "😮", "😮‍💨", "😢", "😭", "😤", "😡", "🤔", "🫠", "🤯"] },
  { name: "People", emojis: ["👍", "👎", "👏", "🙌", "🙏", "💪", "👀", "🫶", "🤝", "✌️", "👋", "🤞", "🫡", "💃", "🕺", "🏃‍♀️", "🧘‍♀️"] },
  { name: "Hearts & symbols", emojis: ["❤️", "♥️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💔", "✨", "⭐", "🌟", "💯", "✅", "❌", "⚡", "🎯"] },
  { name: "Nature & food", emojis: ["🔥", "🌈", "☀️", "🌙", "❄️", "🌸", "🌻", "🍀", "🌴", "🐶", "🐱", "🦋", "🍑", "🍕", "🍻", "☕", "🍰"] },
  { name: "Activities", emojis: ["🚀", "🎉", "🎊", "🏆", "🥇", "🎵", "🎮", "📚", "🎨", "⚽", "🏀", "🚴", "🏋️", "🧘", "💤", "💩"] },
] as const;

// Grapheme-counting alone accepts fake ZWJ combinations. RGI matches whole
// emoji sequences, including flags, skin tones, keycaps and joined emoji.
function matchesCompleteEmoji(value: string): boolean {
  const match = emojiRegex().exec(value);
  return match?.index === 0 && match[0].length === value.length;
}

export function isReactionEmoji(value: string): boolean {
  const emoji = value.trim();
  if (!emoji || emoji.length > 32 || /\s/u.test(emoji)) return false;
  if (matchesCompleteEmoji(emoji)) return true;
  // Some keyboards add optional emoji presentation to a single symbol.
  if (emoji.endsWith("\uFE0F") && matchesCompleteEmoji(emoji.slice(0, -1))) return true;
  // Accept newer single-codepoint emoji beyond the regex's Unicode data.
  return /^\p{Extended_Pictographic}\uFE0F?$/u.test(emoji);
}

export function normalizeReactionEmojiInput(value: string): string {
  const input = value.trim();
  if (!input) return "";
  if (isReactionEmoji(input)) return input;

  // Keep only the first complete emoji from a paste or keyboard insertion.
  // This also works in Hermes without Intl.Segmenter.
  for (const match of input.matchAll(emojiRegex())) {
    if (isReactionEmoji(match[0])) return match[0];
  }

  return "";
}

export function normalizeReactionEmojis(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_REACTION_EMOJIS];

  const emojis = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(isReactionEmoji)
    .filter((emoji, index, items) => items.indexOf(emoji) === index)
    .slice(0, MAX_REACTION_EMOJIS);

  return emojis.length > 0 ? emojis : [...DEFAULT_REACTION_EMOJIS];
}
