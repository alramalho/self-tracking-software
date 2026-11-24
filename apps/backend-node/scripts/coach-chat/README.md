# Chat coach benchmark

Does the coach's chat reply help the person who sent it? A regression check for prompt and model changes,
not a test of how the coach works inside.

People text the coach like a friend: one word ("Today."), the same sentence twice, a correction ("I already
did that"), a target with their own maths. Every case in `cases.ts` is a message that was really sent
(Oct–Nov 2026, 144 messages in all), with the conversation the coach had then. Each case says what the
person would notice in a good reply, in two or three lines. Nothing more: add a case only when a real
reply went wrong in a new way.

A reply passes when it keeps the rules every chat reply keeps (a reply arrives, no raw JSON, at most one
question, at most 70 words unless they asked for more) and a judge from another model family
(`anthropic/claude-sonnet-5.5`) says it does every expected thing and that the person would be glad to
get it.

The run uses the real coach (prompts, tools, web search) with the database swapped for an in-memory copy
of the case, so nothing is read or written there, and its AI calls stay out of the app's usage log. It
needs the production gateway key, so run it inside `tsw-backend`:

```
tar czf - --exclude=runs scripts/coach-chat | ssh -i ~/.ssh/hetzner_ed25519 root@89.167.84.67 \
  'docker exec -i tsw-backend sh -c "tar xzf - && find scripts/coach-chat -name ._\* -delete"'
docker exec tsw-backend sh -c 'TZ=UTC node --import tsx scripts/coach-chat/run.ts \
  --models openai/gpt-5.6-luna,deepseek/deepseek-v4.1-flash --runs 2'   # --only hsk-deadline,first-walk
```

It prints every reply with what it missed, then pass counts, latency and cost per model. Two runs of all
cases on two models cost about $0.60.

## 24 Nov 2026: gpt-5.6-luna vs deepseek-v4.1-flash

Two runs each (`runs/2026-11-24-12-42.json`), web search on gpt-6-luna for both.

| | gpt-5.6-luna | deepseek-v4.1-flash |
| --- | --- | --- |
| Replies passing | 9/18 | 11/18 |
| Median / slowest reply | 3 s / 23 s | 4 s / 84 s |
| Coach cost (with searches) | $0.10 | $0.34 |

- Both fail `hsk-deadline`: they question the person's own 12-a-day maths and ask a question instead of
  changing the plan. DeepSeek ran several searches there and took 82–84 s.
- Only DeepSeek fixes the plan when the course is named twice (card aligned to the course); luna asks which
  lesson they're on.
- Luna lectures on "I lost motivation." (74–76 words); DeepSeek once offers a lighter week nobody asked for.
- Both: "Was hast du gestern gemacht?" / "Wie viele Tage hat eine Woche?" with no English.

Same day, `openai/gpt-6-luna` (`runs/2026-11-24-12-53.json`): **13/18**, median 6 s, slowest 43 s, $0.15.
It misses only `hsk-deadline` (both runs), `course-said-twice` (asks again or no plan change) and one long
`lost-motivation`.

One web search per reply (`runs/2026-11-24-12-58-search-cap.json`, the two searching cases × 3, coach
change tried with `--agent`): `course-said-twice` passes 3/3 on both models (gpt-6-luna was 0/2 before, now
attaches a card each time). `hsk-deadline` still fails on both, and DeepSeek still takes 66–79 s there with a
single search, so its slowness is reasoning over the search results, not the number of searches.

Shipped 24 Nov 2026 (image `coach-gpt6-20261124`): the chat coach on gpt-6-luna (`COACH_AGENT_MODEL`) with
at most **two** searches per reply (the owner's call: one is too tight). First live smoke run: quiz and
one-word answer pass; `course-said-twice` asked for the course again once (24 s), so the 3/3 from the
one-search run isn't confirmed at two.

`hsk-deadline` rewritten the same day with the owner: the coach shouldn't be agreeable, so pushing back
with a reason is fine; it still has to move forward on the course the person follows. Live gpt-6-luna, 3 runs
(report not kept): 0/3. Every reply gives a fair reality check, then only asks (exam or word target? which
module?) with no plan change; one run even picked the wrong course ("Chinese for Beginners").

Not covered: Talk to coach and proactive messages (`scripts/coach-journeys`), plan creation
(`scripts/plan-design-bench`).
