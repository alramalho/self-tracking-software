/**
 * Coach journeys benchmark: when the coach reaches out, and what it says and asks.
 *
 *   TZ=UTC node --import tsx scripts/coach-journeys/run.ts            # when: free, deterministic
 *   TZ=UTC node --import tsx scripts/coach-journeys/run.ts --live     # + what: real model, inside tsw-backend
 *
 * The deterministic layer runs the real scheduling and alert code over simulated weeks (see simulate.ts)
 * with a scripted coach. --live replaces the scripted coach with the real one, writes the proactive
 * messages with the real prompts, checks the rules every text must keep, and asks a judge model whether
 * each text is worth a busy person's attention. Cost is printed; a full live run is about $0.05.
 */
import fs from "node:fs";
import path from "node:path";
import { journeys } from "./journeys";
import { checkJourney, simulate, weekdayName, type Journey, type SimResult } from "./simulate";

async function main() {
  const live = process.argv.includes("--live");
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
  const selected = journeys.filter((j) => !only || only.includes(j.id));
  const lv = live ? await import("./live") : null;
  let whenFailed = 0;
  let texts = 0;
  let textsFailed = 0;
  const report: unknown[] = [];
  for (const journey of selected) {
    const result = await simulate(journey, lv?.liveTalk);
    const problems = checkJourney(journey, result);
    if (problems.length) whenFailed++;
    console.log(`${problems.length ? "✗" : "✓"} ${journey.id}: ${summary(result)}`);
    for (const p of problems) console.log(`    when: ${p}`);
    if (!lv) continue;

    // What the coach said in each Talk to coach conversation.
    for (const [i, talk] of result.talks.entries()) {
      const screens = talk.turns.map((t) => t.shown);
      const transcript = talk.turns.map((t) => `${t.said ? `them: ${t.said}\n` : ""}coach: ${t.shown.say} ${t.shown.detail}`).join("\n");
      const rules = lv.scoreTalk(journey.expect.talks?.[i], screens);
      const verdict = await lv.judge(`Today is ${dateOf(talk.day)}, evening. They opened the "what got in the way?" drawer and tapped "${talk.reason}". ${facts(journey, talk.day, 20)}`, transcript);
      const failed = rules.length > 0 || !verdict.worthIt;
      texts++;
      if (failed) textsFailed++;
      console.log(`    ${failed ? "✗" : "✓"} talk ${i + 1} (${talk.reason}, ${weekdayName(talk.day)}): ${transcript.replace(/\n/g, " / ")}`);
      for (const p of rules) console.log(`        rule: ${p}`);
      if (!verdict.worthIt) console.log(`        judge: ${verdict.why}`);
      report.push({ journey: journey.id, kind: "talk", transcript, rules, verdict });
    }
    // What the coach wrote when it reached out on its own.
    for (const message of await lv.liveMessages(journey, result)) {
      const expect = journey.expect.messages?.find((m) => m.kind === message.kind);
      const rules = lv.scoreMessage(expect, message.text);
      const hour = message.kind === "nudge" ? 8 : 18;
      const verdict = await lv.judge(`Today is ${dateOf(message.day)}, ${hour}:07. The coach reaches out on its own (${message.kind}). ${facts(journey, message.day, hour)}`, message.text);
      const failed = rules.length > 0 || !verdict.worthIt;
      texts++;
      if (failed) textsFailed++;
      console.log(`    ${failed ? "✗" : "✓"} ${message.kind} (${weekdayName(message.day)}): ${message.text}`);
      for (const p of rules) console.log(`        rule: ${p}`);
      if (!verdict.worthIt) console.log(`        judge: ${verdict.why}`);
      report.push({ journey: journey.id, kind: message.kind, text: message.text, rules, verdict });
    }
  }
  console.log(`when: ${selected.length - whenFailed}/${selected.length} journeys pass`);
  if (lv) {
    console.log(`what: ${texts - textsFailed}/${texts} coach texts pass, $${lv.liveSpend().toFixed(4)}`);
    const out = path.join(__dirname, "runs", `live-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
  }
  if (whenFailed || textsFailed) process.exitCode = 1;
}

const summary = (r: SimResult) => {
  const touches = r.touches.map((t) => `${t.push ? "push" : "silent"} ${t.kind} ${weekdayName(t.day)}${t.day >= 7 ? "²" : ""} ${t.at.slice(11, 16)}`);
  return `${touches.join(" | ") || "no contact"}; drawer ${r.alertDays.map((d) => `${weekdayName(d)}${d >= 7 ? "²" : ""}`).join(" ") || "never"}; talks ${r.talks.map((t) => t.ended).join(", ") || "none"}`;
};

const dateOf = (day: number) => new Date(Date.UTC(2026, 10, 1 + day)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** What the coach knew at that moment: the plan, the logs, and what was said before, in days ago. */
const facts = (j: Journey, day: number, hour: number) => {
  const ago = (d: number) => (d === day ? "today" : d === day - 1 ? "yesterday" : `${day - d} days ago (${dateOf(d)})`);
  const before = (e: { day: number; at: string }) => e.day < day || (e.day === day && Number(e.at.slice(0, 2)) < hour);
  const logs = [...j.pastLogs.map((d) => -d), ...j.events.filter((e) => "log" in e && before(e)).map((e) => e.day)].sort((a, b) => a - b);
  const said = (j.pastMessages ?? []).map((m) => `${ago(-m.daysBefore)}: ${m.from === "USER" ? "they" : "coach"}: ${m.text}`);
  const answered = j.events
    .filter((e) => "answerAlert" in e && before(e))
    .map((e) => `${ago(e.day)}: they tapped "${(e as { answerAlert: { reason: string } }).answerAlert.reason}" and said ${JSON.stringify((e as { answerAlert: { answers: string[] } }).answerAlert.answers)}`);
  const notes = j.events.filter((e) => "log" in e && before(e) && (e as { note?: string }).note).map((e) => `${ago(e.day)} they logged it as ${(e as { difficulty?: string }).difficulty ?? ""} with the note "${(e as { note?: string }).note}"`);
  return [
    `Plan: ${j.plan.goal}.`,
    `Logged: ${logs.map(ago).join(", ") || "never"}.`,
    ...notes.map((n) => `${n}.`),
    `Before this: ${[...said, ...answered].join(" | ") || "nothing"}.`,
  ].join(" ");
};

main();
