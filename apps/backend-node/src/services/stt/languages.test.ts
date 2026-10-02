import { describe, expect, it } from "vitest";
import { parseTranscriptionFeedback } from "./feedback";
import {
  languageCode,
  languageToRequest,
  languageToRetry,
  parseSpokenLanguages,
} from "./languages";

describe("spoken languages", () => {
  it("keeps known codes in the order chosen, main one first", () => {
    expect(parseSpokenLanguages(["PT", " en "])).toEqual(["pt", "en"]);
    expect(parseSpokenLanguages([])).toEqual([]);
  });

  it("rejects unknown codes, repeats, long lists and non-lists", () => {
    expect(parseSpokenLanguages(["xx"])).toBeNull();
    expect(parseSpokenLanguages(["pt", "pt"])).toBeNull();
    expect(parseSpokenLanguages(["pt", "en", "es", "fr", "de", "it"])).toBeNull();
    expect(parseSpokenLanguages("pt")).toBeNull();
    expect(parseSpokenLanguages([{ set: ["pt"] }])).toBeNull();
  });

  it("reads the detected language as a code or a name", () => {
    expect(languageCode("pt")).toBe("pt");
    expect(languageCode("pt-BR")).toBe("pt");
    expect(languageCode("Portuguese")).toBe("pt");
    expect(languageCode("klingon")).toBeUndefined();
    expect(languageCode(undefined)).toBeUndefined();
  });
});

describe("grounding speech to text in the person's languages", () => {
  it("lets the model detect when no languages are saved", () => {
    expect(languageToRequest([])).toBeUndefined();
    expect(languageToRetry([], "ru")).toBeUndefined();
  });

  it("tells the model the language when the person speaks one", () => {
    expect(languageToRequest(["pt"])).toBe("pt");
    expect(languageToRetry(["pt"], "pt")).toBeUndefined();
  });

  it("detects among several, and asks again in the main one when it hears another", () => {
    expect(languageToRequest(["pt", "en"])).toBeUndefined();
    expect(languageToRetry(["pt", "en"], "en")).toBeUndefined();
    expect(languageToRetry(["pt", "en"], "ru")).toBe("pt");
    expect(languageToRetry(["pt", "en"], undefined)).toBeUndefined();
  });
});

describe("transcription feedback", () => {
  it("needs a thumbs up or down", () => {
    expect(parseTranscriptionFeedback({})).toBeNull();
    expect(parseTranscriptionFeedback(null)).toBeNull();
  });

  it("keeps no transcript for a thumbs up", () => {
    expect(
      parseTranscriptionFeedback({
        helpful: true,
        transcript: "private words",
        language: "pt",
        model: "openai/whisper-large-v3",
      }),
    ).toEqual({ helpful: true, language: "pt", model: "openai/whisper-large-v3" });
  });

  it("keeps the reason, the words and what was said for a thumbs down", () => {
    expect(
      parseTranscriptionFeedback({
        helpful: false,
        reason: "WRONG_LANGUAGE",
        comment: " che tás como ",
        transcript: "Сейчас ташком.",
        language: "ru",
        model: "nvidia/parakeet-tdt-0.6b-v3",
      }),
    ).toEqual({
      helpful: false,
      reason: "WRONG_LANGUAGE",
      comment: "che tás como",
      transcript: "Сейчас ташком.",
      language: "ru",
      model: "nvidia/parakeet-tdt-0.6b-v3",
    });
    expect(
      parseTranscriptionFeedback({ helpful: false, reason: "NOT_A_REASON" })?.reason,
    ).toBeUndefined();
  });
});
