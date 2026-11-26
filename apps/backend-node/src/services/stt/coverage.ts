// gpt-4o-transcribe sometimes drops a whole part of a voice note: on replays of real notes (26 Nov 2026) it
// returned only "I've been doing Chinese daily for like 90 minutes." and lost "…the ones I did not fill in,
// fill them in", and once kept only the last sentence of "Mark that I did my Chinese lessons yesterday … and I
// just went to the gym". Whisper large-v3 kept every part of all 11 stored notes, but adds filler ("*gunshots*",
// "Thank you.") and takes 0.4–8 s. So both run, and Whisper's text is used only when it clearly heard more.

/** Whisper's usual inventions: sound labels and a closing "Thank you." */
export function withoutWhisperFiller(text: string): string {
  return text
    .trim()
    .replace(/\*[^*]*\*|\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/(^|[.!?]\s+)(thank you|thanks for watching|obrigad[oa])[.!]?(?=\s|$)/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * The transcript to keep. `check` (Whisper) replaces `primary` only when it has at least 4 more words and a
 * quarter more in all: rewording one sentence never moves the count that far, a dropped clause does.
 */
export function fullerTranscript(primary: string, check: string): { text: string; usedCheck: boolean } {
  const cleaned = withoutWhisperFiller(check);
  const heard = wordCount(primary);
  const checked = wordCount(cleaned);
  const usedCheck = checked >= heard + 4 && checked >= heard * 1.25;
  return usedCheck ? { text: cleaned, usedCheck } : { text: primary, usedCheck };
}
