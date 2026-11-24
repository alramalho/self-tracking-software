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

Not covered: Talk to coach and proactive messages (`scripts/coach-journeys`), plan creation
(`scripts/plan-design-bench`).
