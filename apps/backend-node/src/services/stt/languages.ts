// Languages the speech-to-text model can be told to listen for (ISO 639-1 code
// and the name the model reports back when it detects one).
const LANGUAGES: Record<string, string> = {
  af: "afrikaans", am: "amharic", ar: "arabic", as: "assamese", az: "azerbaijani",
  ba: "bashkir", be: "belarusian", bg: "bulgarian", bn: "bengali", bo: "tibetan",
  br: "breton", bs: "bosnian", ca: "catalan", cs: "czech", cy: "welsh",
  da: "danish", de: "german", el: "greek", en: "english", es: "spanish",
  et: "estonian", eu: "basque", fa: "persian", fi: "finnish", fo: "faroese",
  fr: "french", gl: "galician", gu: "gujarati", ha: "hausa", he: "hebrew",
  hi: "hindi", hr: "croatian", ht: "haitian creole", hu: "hungarian", hy: "armenian",
  id: "indonesian", is: "icelandic", it: "italian", ja: "japanese", jw: "javanese",
  ka: "georgian", kk: "kazakh", km: "khmer", kn: "kannada", ko: "korean",
  la: "latin", lb: "luxembourgish", ln: "lingala", lo: "lao", lt: "lithuanian",
  lv: "latvian", mg: "malagasy", mi: "maori", mk: "macedonian", ml: "malayalam",
  mn: "mongolian", mr: "marathi", ms: "malay", mt: "maltese", my: "myanmar",
  ne: "nepali", nl: "dutch", nn: "nynorsk", no: "norwegian", oc: "occitan",
  pa: "punjabi", pl: "polish", ps: "pashto", pt: "portuguese", ro: "romanian",
  ru: "russian", sa: "sanskrit", sd: "sindhi", si: "sinhala", sk: "slovak",
  sl: "slovenian", sn: "shona", so: "somali", sq: "albanian", sr: "serbian",
  su: "sundanese", sv: "swedish", sw: "swahili", ta: "tamil", te: "telugu",
  tg: "tajik", th: "thai", tk: "turkmen", tl: "tagalog", tr: "turkish",
  tt: "tatar", uk: "ukrainian", ur: "urdu", uz: "uzbek", vi: "vietnamese",
  yi: "yiddish", yo: "yoruba", zh: "chinese",
};
const CODE_BY_NAME = new Map(
  Object.entries(LANGUAGES).map(([code, name]) => [name, code]),
);

export const MAX_SPOKEN_LANGUAGES = 5;

// What a person may save as their languages: known codes, no repeats, main one first.
// Returns null when the input isn't a valid list.
export function parseSpokenLanguages(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_SPOKEN_LANGUAGES) return null;
  const codes = input.map((code) =>
    typeof code === "string" ? code.trim().toLowerCase() : "",
  );
  if (codes.some((code) => !(code in LANGUAGES))) return null;
  return new Set(codes).size === codes.length ? codes : null;
}

// Providers report the detected language as a code ("pt", "pt-BR") or a name ("portuguese").
export function languageCode(detected?: string | null): string | undefined {
  const value = detected?.trim().toLowerCase();
  if (!value) return undefined;
  const code = value.split(/[-_]/)[0];
  return code in LANGUAGES ? code : CODE_BY_NAME.get(value);
}

// One language: tell the model before it listens.
export function languageToRequest(spoken: string[]): string | undefined {
  return spoken.length === 1 ? spoken[0] : undefined;
}

// Several languages: the model detects. If it heard one the person doesn't speak
// (short clips are often misheard as another language), ask again in their main one.
export function languageToRetry(
  spoken: string[],
  detected?: string,
): string | undefined {
  if (spoken.length < 2 || !detected || spoken.includes(detected)) return undefined;
  return spoken[0];
}
