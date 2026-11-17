// What speech-to-text hears before a voice log (gpt-4o-transcribe reads the prompt as the text that came before).
//
// Watch voice notes mostly start with "Log …", and production heard that first word as "Long", "No" or "Walk"
// (13–17 Nov 2026). On 17 Nov, 24 synthetic "Log …" clips whose speech starts right at 0 s got the first word
// right 16 times with the old prompt ("The speaker speaks English. Transcribe exactly…"), 18 with no prompt,
// 17 with a Better Groceries-style prompt (context, example sentences, "it usually starts with Log") and 19 with
// this one: one line of context in the person's language and their own activity and metric names. Cutting the
// first 120 ms of audio lost "Log" under every prompt, so the watch also signals when it is really listening.

type VoiceNotePrompt = { intro: string; words: string };

const PROMPTS: Record<string, VoiceNotePrompt> = {
  en: { intro: "Voice note for a habit tracker, in English.", words: "Activities and metrics:" },
  pt: { intro: "Nota de voz para uma app de hábitos, em português.", words: "Atividades e métricas:" },
  es: { intro: "Nota de voz para una app de hábitos, en español.", words: "Actividades y métricas:" },
  de: { intro: "Sprachnotiz für eine Gewohnheits-App, auf Deutsch.", words: "Aktivitäten und Werte:" },
  fr: { intro: "Note vocale pour une app d’habitudes, en français.", words: "Activités et indicateurs :" },
  it: { intro: "Nota vocale per un’app di abitudini, in italiano.", words: "Attività e metriche:" },
  nl: { intro: "Spraakmemo voor een gewoonte-app, in het Nederlands.", words: "Activiteiten en metingen:" },
};

const plain = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * `spoken`: the person's languages, main one first (users.spokenLanguages; English when unset). `words`: their
 * activity and metric titles, most used first. Languages without a prompt here fall back to English context.
 */
export function voiceNotePrompt(spoken: string[], words: string[]): string {
  const known = spoken.filter((code) => PROMPTS[code]);
  const languages = known.length ? known : ["en"];
  const unique = [...new Set(words.map((word) => word.trim()).filter(Boolean))].slice(0, 40);
  const vocabulary = unique.length ? `${PROMPTS[languages[0]].words} ${unique.join(", ")}.` : "";
  return [...languages.map((code) => PROMPTS[code].intro), vocabulary].filter(Boolean).join(" ");
}

/** The model returns the prompt itself (the intro, or the list of words) when it hears nothing. */
export function isVoiceNotePromptEcho(transcript: string, spoken: string[], words: string[]): boolean {
  const text = plain(transcript);
  if (!text) return true;
  const languages = spoken.filter((code) => PROMPTS[code]);
  for (const code of languages.length ? languages : ["en"]) {
    const { intro, words: label } = PROMPTS[code];
    if ([intro, label].some((sentence) => plain(sentence) === text)) return true;
  }
  const list = plain(words.join(" "));
  return text.length > 12 && list.startsWith(text) && text.split(" ").length > 2;
}
