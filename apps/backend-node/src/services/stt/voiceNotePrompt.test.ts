import { describe, expect, it } from "vitest";
import { isVoiceNotePromptEcho, voiceNotePrompt } from "./voiceNotePrompt";

describe("voice note prompt", () => {
  it("primes the model with the context, examples and the person's own activities", () => {
    const prompt = voiceNotePrompt(["en"], ["Reading", "Meditation", "Energy"]);
    expect(prompt).toMatch(/^Voice note for a habit tracker, in English\./);
    expect(prompt).toMatch(/Activities and metrics: Reading, Meditation, Energy\.$/);
  });

  it("speaks the person's language, and shows the mix for several", () => {
    expect(voiceNotePrompt(["pt"], [])).toMatch(/^Nota de voz/);
    const mixed = voiceNotePrompt(["pt", "en"], ["Leitura"]);
    expect(mixed).toContain("em português");
    expect(mixed).toContain("in English");
    expect(mixed).toMatch(/Atividades e métricas: Leitura\.$/);
  });

  it("falls back to English context for languages it has no prompt for", () => {
    expect(voiceNotePrompt(["ja"], [])).toContain("in English");
  });

  it("treats the prompt coming back as silence, and a real note as speech", () => {
    expect(isVoiceNotePromptEcho("Voice note for a habit tracker, in English.", ["en"], [])).toBe(true);
    expect(isVoiceNotePromptEcho("Reading, Meditation, Energy", ["en"], ["Reading", "Meditation", "Energy"])).toBe(true);
    expect(isVoiceNotePromptEcho("", ["en"], [])).toBe(true);
    expect(isVoiceNotePromptEcho("Log half an hour of reading.", ["en"], ["Reading"])).toBe(false);
    expect(isVoiceNotePromptEcho("Reading", ["en"], ["Reading", "Meditation"])).toBe(false);
  });
});
