# Store metadata

Fastlane-style listing copy: `deliver` for `ios/`, `supply` for `android/`. Nothing here has been uploaded. Per the building principles, send the owner all listing copy and media before any submission.

```bash
node store-metadata/validate.mts
```

The validator checks Apple limits (name and subtitle 30, keywords 100, promotional text 170, description and release notes 4000) and Google Play limits (title 30, short description 80, full description 4000). It also checks keyword hygiene: no spaces around commas, no duplicate terms, and no words already in the name or subtitle.

## iOS positioning

Lead with what is different: an AI coach that plans your week, accountability with friends, Apple Health workouts matched for you to confirm, and bring-your-own-curriculum over MCP. "Build habits that stick" is generic and is no longer used as a headline.

**Before submitting, check the copy against the exact build.**

| Claim | Where it lives in the app |
| --- | --- |
| Apple Health workout matching | Health V0. `apps/frontend-expo/BUILDING.md` records it in local build 29 and later, and TestFlight build 162 has Apple Health workout charts. Build 26 (cited in the September 15 review) does not have it. If the submitted build lacks it, remove the "APPLE HEALTH, MATCHED FOR YOU" block, the promotional-text clause and the release-note line. |
| Apple Watch logging and voice notes | Build 26 and later |
| Weekly review, coach check-ins, MCP | Current source |
| "AI coaching is an optional subscription" | Wording is store-neutral. Apple in-app purchase is still to come; see [RevenueCat plan](../docs/revenuecat-plan.md). |

`release_notes.txt` only matters if a version is already live on this App Store record. A first release does not show "What's New".

## Screenshot order and headlines (`../marketing/app-store-2026-09/`)

Only the first 2–3 screenshots show in search results, so they carry the differentiators: the coach first, then friends.

| New position | File | Current headline | Suggested headline |
| --- | --- | --- | --- |
| 1 | `02-coach.png` | Your coach, week by week | **An AI coach that plans your week** |
| 2 | `05-friends.png` | Stay close with friends | **Friends keep you going** |
| 3 | `03-streaks.png` | Never lose a streak quietly | **Your coach checks in when you slip** |
| 4 | `04-plan.png` | Your plan, your pace | **Every goal becomes a weekly plan** |
| 5 | `06-watch.png` | On your wrist too | **Log from your wrist, even by voice** |
| 6 | `01-habits.png` | Build habits that stick | **All your goals at a glance** |

Suggested addition: an Apple Health match screenshot as position 3, headlined **Workouts matched from Apple Health**, if the submitted build includes it. `raw/` has no Health capture yet. It would show the workout review drawer with a suggested activity and a Confirm button, in light mode like the others.

## Android (draft)

`android/en-US/` is a draft for later. It leaves out Apple Watch and Apple Health and makes no platform-integration claims until an Android build exists.
