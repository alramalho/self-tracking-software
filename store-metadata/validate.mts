// Validates store listing copy against App Store Connect and Google Play limits.
// Run from the repo root: node store-metadata/validate.mts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface FieldRule {
  file: string;
  max: number;
  required: boolean;
}

const root = path.dirname(new URL(import.meta.url).pathname);

// Apple: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
const iosRules: FieldRule[] = [
  { file: "name.txt", max: 30, required: true },
  { file: "subtitle.txt", max: 30, required: true },
  { file: "keywords.txt", max: 100, required: true },
  { file: "promotional_text.txt", max: 170, required: false },
  { file: "description.txt", max: 4000, required: true },
  { file: "release_notes.txt", max: 4000, required: false },
];
// Google Play: title 30, short description 80, full description 4000.
const androidRules: FieldRule[] = [
  { file: "title.txt", max: 30, required: true },
  { file: "short_description.txt", max: 80, required: true },
  { file: "full_description.txt", max: 4000, required: true },
];

const errors: string[] = [];
const read = (file: string) =>
  existsSync(file) ? readFileSync(file, "utf8").trim() : undefined;
const length = (text: string) => [...text].length;
const words = (text: string) =>
  text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
// "goal" and "goals" count as the same word for Apple's keyword index.
const stem = (word: string) => word.replace(/(es|s)$/, "");

function checkLimits(dir: string, rules: FieldRule[]) {
  for (const rule of rules) {
    const text = read(path.join(dir, rule.file));
    const label = path.relative(root, path.join(dir, rule.file));
    if (text === undefined || text === "") {
      if (rule.required) errors.push(`${label}: missing or empty`);
      continue;
    }
    const count = length(text);
    const status = count > rule.max ? "✗" : "✓";
    console.log(`${status} ${label.padEnd(32)} ${String(count).padStart(4)} / ${rule.max}`);
    if (count > rule.max) errors.push(`${label}: ${count} characters (max ${rule.max})`);
  }
}

function checkKeywords(dir: string) {
  const keywords = read(path.join(dir, "keywords.txt"));
  if (!keywords) return;
  const label = path.relative(root, path.join(dir, "keywords.txt"));
  if (/,\s|\s,/.test(keywords))
    errors.push(`${label}: remove spaces around commas, they waste characters`);
  const terms = keywords.split(",").map((term) => term.trim().toLowerCase());
  const duplicates = terms.filter((term, index) => terms.indexOf(term) !== index);
  if (duplicates.length) errors.push(`${label}: duplicate terms ${duplicates.join(", ")}`);
  if (terms.some((term) => !term)) errors.push(`${label}: empty term`);
  // Apple already indexes the name and subtitle, so repeating their words wastes space.
  const indexed = new Set(
    [read(path.join(dir, "name.txt")), read(path.join(dir, "subtitle.txt"))]
      .flatMap((text) => words(text ?? ""))
      .map(stem),
  );
  const repeated = terms.flatMap(words).filter((word) => indexed.has(stem(word)));
  if (repeated.length)
    errors.push(`${label}: repeats name/subtitle words ${[...new Set(repeated)].join(", ")}`);
}

const locales = (platform: string) => {
  const dir = path.join(root, platform);
  return existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(dir, entry.name))
    : [];
};

for (const dir of locales("ios")) {
  checkLimits(dir, iosRules);
  checkKeywords(dir);
}
for (const dir of locales("android")) checkLimits(dir, androidRules);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll store metadata is within limits.");
