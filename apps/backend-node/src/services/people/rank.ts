import type { SearchablePerson } from "./types";
export const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/^@/, "");

function activityTime(person: SearchablePerson) {
  if (!person.lastActivityAt) return 0;
  const value = new Date(person.lastActivityAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function compareActivity(a: SearchablePerson, b: SearchablePerson) {
  return (b.activityCount ?? 0) - (a.activityCount ?? 0)
    || activityTime(b) - activityTime(a)
    || (a.username ?? "").localeCompare(b.username ?? "");
}

function distance(a: string, b: string) {
  let previous = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i=1; i<=a.length; i++) {
    const row = [i];
    for (let j=1; j<=b.length; j++) row[j] = Math.min(row[j-1] + 1, previous[j] + 1, previous[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    previous = row;
  }
  return previous[b.length];
}
function matchScore(value: string, query: string) {
  if (value === query) return 100;
  if (value.startsWith(query)) return 90;
  if (value.includes(query)) return 80;
  if (query.length < 3) return 0;
  const parts = [value, ...value.split(/\s+/)];
  const typo = Math.min(...parts.map(part => distance(part, query)));
  if (typo <= (query.length < 5 ? 1 : 2)) return 65 - typo * 10;
  // Abbreviations such as "lia" can still find "liocas" after stronger name matches.
  let index = 0;
  for (const letter of value) if (letter === query[index]) index++;
  return index === query.length ? 30 : 0;
}
export function rankPeople<T extends SearchablePerson>(people: T[], raw: string, limit = 10): T[] {
  const query = normalizeSearch(raw).slice(0, 80);
  if (!query) return [...people].sort(compareActivity).slice(0, limit);
  return people.map(person => ({ person, score: Math.max(matchScore(normalizeSearch(person.username ?? ""), query), matchScore(normalizeSearch(person.name ?? ""), query)) }))
    .filter(result => result.score > 0)
    .sort((a,b) => b.score-a.score || compareActivity(a.person, b.person))
    .slice(0,limit).map(result => result.person);
}
