# Voice-log benchmark

Transcript + activity catalog → which activities, how much, which day, which metrics, through the real
extraction code (`src/services/voice-log/extract.ts`). Text only: it measures matching and extraction, not
speech-to-text.

- `cases.ts`: 57 cases. The catalog is the owner's real activity list (ids replaced by slugs). Two cases are
  real saved voice notes, the rest are written from how the owner logs (running in km, meditation in minutes,
  gym in sessions) in English and Portuguese, with decimals, self-corrections, mishearings, plans, several
  activities per note, and a second person's catalog.
- `run.ts`: runs configs `prompt:model:effort`, caches each answer in `runs/`, and prints pass rate, Gateway
  cost and median latency. A case passes only if the activity set, quantities, dates and metrics are all right
  (plus, where set, the run's time or pace kept in its description, or a guessless amount flagged as unresolved).

Run it inside the backend container (the local gateway key doesn't work); see the header of `run.ts`.

## 12 Nov 2026

Production voice notes were not stored, so the owner's failed running note couldn't be read back. From now
on every preview and commit is appended to `voice-logs.jsonl` next to `ai-usage.jsonl` on the host
(`src/services/voice-log/samples.ts`), so real failures can become cases here.

| Setup | Passed | Cost (57 notes) | Median model time |
| --- | --- | --- | --- |
| **Before**: old prompt, whole-number quantities, gpt-5.6-luna xhigh | 49/57 | $0.057 | 2.7 s |
| Old prompt, gpt-6-luna low | 48/57 | $0.014 | 2.1 s |
| New prompt, whole numbers, gpt-5.6-luna xhigh | 55/57 | $0.048 | 2.3 s |
| New prompt, whole numbers, gpt-6-luna low | 56/57 | $0.018 | 2.4 s |
| New prompt, whole numbers, gpt-6-luna medium | 57/57 | $0.019 | 2.7 s |
| New prompt, whole numbers, claude-haiku-5.5 | 56/57 | $0.036 | 2.5 s |
| New prompt, whole numbers, gemini-3.8-flash (first 37 cases) | 37/37 | $0.146 | 4.8 s |
| New prompt, decimals rounded in code, gpt-6-luna low (2 runs) | 57/57, 56/57 | $0.004 | 1.7 s |
| **After**: new prompt, decimals rounded in code, gpt-6-luna medium (2 runs) | 57/57, 57/57 | $0.005–0.007 | 4.2–4.8 s |
| New prompt, decimals rounded in code, claude-haiku-5.5 | 57/57 | $0.032 | 2.2 s |

What the old setup got wrong was mostly decimal runs: "5.4 kilometers", "six point three K" and "oito vírgula
dois quilómetros" were dropped, because the model had to return a whole number and gave up instead of rounding.
It also rounded 7.8 km to 7, logged two runs as one 3 km run plus an extra, and lost the time of a run from the
description. The fix: the model returns the amount as said (decimals allowed) and the code rounds it; the prompt
matches by meaning (synonyms, verb forms, Portuguese, misheard words), prefers the recently used one of two
duplicate activities (`lastLoggedOn`), sums repeated sessions, and keeps time and pace in the description.

Total Gateway spend for all of the runs above, smoke tests included: about $0.5 at most (the totals above include cached answers, so the real figure is lower).
