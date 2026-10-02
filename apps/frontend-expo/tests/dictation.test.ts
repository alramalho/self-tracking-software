import { test } from "node:test";
import assert from "node:assert/strict";
import {
  languagesSummary,
  spokenLanguages,
  toggleLanguage,
} from "../src/features/dictation/languages";

test("tapping a language adds it after the main one, or removes it", () => {
  assert.deepEqual(toggleLanguage([], "pt"), ["pt"]);
  assert.deepEqual(toggleLanguage(["pt"], "en"), ["pt", "en"]);
  assert.deepEqual(toggleLanguage(["pt", "en"], "pt"), ["en"]);
});

test("a sixth language is ignored", () => {
  const five = ["pt", "en", "es", "fr", "de"];
  assert.deepEqual(toggleLanguage(five, "it"), five);
});

test("the Settings row names the languages, main one first", () => {
  assert.equal(languagesSummary(undefined), "Detected automatically");
  assert.equal(languagesSummary(["pt"]), "Portuguese");
  assert.equal(languagesSummary(["pt", "en"]), "Portuguese and English");
  assert.equal(languagesSummary(["pt", "en", "es"]), "Portuguese, English and Spanish");
});

test("every offered language has a unique two-letter code", () => {
  const codes = spokenLanguages.map((language) => language.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((code) => /^[a-z]{2}$/.test(code)));
});
