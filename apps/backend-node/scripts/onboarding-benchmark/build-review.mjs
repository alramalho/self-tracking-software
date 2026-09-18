import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const directory = path.dirname(fileURLToPath(import.meta.url));
const text = await fs.readFile(path.join(directory, 'cases-v2.json'), 'utf8');
const cases = JSON.parse(text);
const prompt = await fs.readFile(path.join(directory, 'prompt-v2.md'), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const quote = value => value.split('\n').map(line => `> ${line}`).join('\n');
const intro = `# Benchmark cases for review — v2

**Draft. No model comparison has run on these cases.** Please review the case openings, informed checkpoints and capability boundary before approving a run. All detailed scenarios are synthetic; real user messages, notes and identity data are not sent to models.

## What the coach is being tested to do

Help someone follow through on a goal or an existing learning/training programme: clarify the commitment, fit it to available time, choose a practical next action, and propose adjustments. Work with Pickup Music, a running coach or another selected resource. Do not replace their teaching, invent course content, assess unseen technique or prescribe clinical care. A simple-tracker request should end the coaching interview.

This boundary follows the user's latest clarification and is itself pending review. Model scores will not establish that the app improves habit consistency; that needs subsequent user evaluation. This pilot also cannot establish expert correctness of training or nutrition advice.

## Why these cases

Read-only production snapshot at **2026-09-14 21:37:58 UTC**, from the running production backend's database. 337 total accounts; 324 non-deleted accounts. Explicit synthetic ID/email patterns matched zero additional accounts; there is no definitive test-user flag, so this is not a claim that every remaining account is a verified real customer.

| Cohort | Accounts | Accounts with saved plans | Weekly / specific plans |
| --- | ---: | ---: | ---: |
| Joined in the last 90 days | 28 | 10 | 9 / 1 |
| Latest 50 signups | 50 | 26 | 21 / 5 |
| Active in the last 30 days | 13 | 7 | 12 / 7 |

The latest-50 cohort spans **October 19, 2025–September 12, 2026**. It is a broader check, not another 90-day cohort. Cohorts overlap and must not be added together. Active means a recent lastActiveAt or activity datetime; only 4 accounts actually logged activities in the last 30 days. No last-30-day activity logs were found for either signup cohort. Saved plans therefore show expressed use cases, not demonstrated sustained use or demand for paid coaching. A missing completion flag does not prove onboarding was abandoned.

Stored plan categories among latest-50 accounts: weight management 4; habit building, meditation and reading 3 each; productivity, running and career 2 each; other categories 1 each. Last-90-day signups include meditation 3, habit building 2 and productivity 2. These are database category labels, not independently adjudicated classifications. Recent activity counts (distinct loggers) include running 3, Pilates 3, gym 2 and cycling 2. Activity counts and goal counts answer different questions.

The sample supports adding meditation, reading, weight management and productivity to the user's exercise, running and guitar examples. Prioritization is a deliberate stress case, not claimed to be a frequent latest-user pattern. Only one active-30-day account has multiple unarchived/unpaused plans. Career and other lower-frequency categories remain outside this small first pilot; it is a stratified diagnostic set, not a frequency-weighted estimate of all production traffic.

## How the comparison works

Each case has two **independent checkpoints**: opening only, then the same opening plus all the supplied facts below. These are not claimed to be a natural conversation answering the model's particular question. Every model receives identical evidence at each checkpoint. Initial questions may differ and can still be good; there is no single required wording or question bank.

For guitar, two additional checkpoints alter one dimension at a time. Do not combine those variants with the base answer. Distinct versions of a scenario are independent; prior model replies are not fed into them.

Eight cases × two checkpoints, plus two guitar variants = **18 responses per model; 90 maximum across five models**, one sample per checkpoint. Vercel AI Gateway only: Muse Spark 1.3, Grok 4.6, Gemini 3.8 Flash, GPT-5.6 Terra and GLM 5.3. Same prompt and rendering envelope; provider-default reasoning settings, recorded latency/token usage. No LLM judge, retries or provider/model substitutions. Inspect outputs blinded before revealing model names where practical; do not claim a statistically reliable winner from this pilot.

For each output, mark acceptable / needs review / fails and briefly explain: one easy input; consequential missing information; use of known facts; feasible action; respect for the teaching provider; respect for tracker-only intent; no invented execution or personal facts. Serious scope or factual errors remain visible, not averaged away by attractive wording. Comparisons of latency are descriptive and may be affected by provider defaults and transient load.

## Exact cases
`;
const sections = cases.map((c, i) => `### ${i + 1}. ${c.id}

**Why included:** ${c.origin}

**Opening shown to the model:**

${quote(c.initial)}

**Additional facts at the independent informed checkpoint:**

${quote(c.followup)}

**What to judge (not sent as a case-specific hint):** ${c.review_focus}
${(c.variants || []).map(v => `
**Controlled variant: ${v.id} — changes ${v.changed_field} only.**

${quote(v.answer)}

Expected difference: ${v.expected_difference}
`).join('')}`).join('\n');
const footer = `
## Review before running

1. Do these eight situations cover the first product we actually want to support?
2. Are the synthetic inputs and time allocations coherent, and are the expected behaviours fair?
3. Is the coach's role limited correctly: follow-through and coordination, with expert teaching owned by the selected course/professional?

The runner requires approval of both the cases and the capability prompt. Reviewing a case set does not authorize app changes, real-user interventions, purchases or notifications. A working AI_GATEWAY_API_KEY is still required; the previously saved local credential returned 401. No new inference calls were made while preparing this revision.

Case source: [cases-v2.json](cases-v2.json). Full shared model prompt: [prompt-v2.md](prompt-v2.md). Runner and source methodology: [README.md](README.md).

Cases SHA-256: ${hash(text)}

Prompt SHA-256: ${hash(prompt)}
`;
await fs.writeFile(path.join(directory, 'CASES-REVIEW.md'), intro + sections + footer);
console.log(`Wrote review for ${cases.length} cases and ${cases.reduce((n,c)=>n+(c.variants?.length||0),0)} controlled variants.`);
