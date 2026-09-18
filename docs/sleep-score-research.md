# Sleep score: research and calibration plan

## Product direction

The user now accepts a tracking.so-calculated sleep score and has offered screenshots of their Apple Sleep Score to help investigate the formula. This supersedes the earlier decision to defer scoring until Apple's exact score is available through HealthKit. No screenshots have been supplied yet; no formula has been fitted or deployed.

The first candidate should be transparent and deterministic, calculated from imported HealthKit data without external AI. Label it as tracking.so's estimate. Keep Apple reference scores separate from calculated scores, with original dates and provenance. Agreement with Apple is a product comparison, not clinical validation.

## Research relevant to the inputs

| Input | Evidence | Implication and limit |
| --- | --- | --- |
| Sleep duration | AASM/SRS recommends at least seven hours regularly for adults aged 18–60 and recognizes individual variation. | Include duration. This does not establish a universal eight-hour optimum, a linear points curve or a penalty for all long sleep. [Consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/) |
| Sleep continuity | The National Sleep Foundation consensus reviewed 277 studies and found agreement on indicators including sleep latency, sustained awakenings, wake after sleep onset and efficiency. | Include interruption burden when observable. Do not equate missing wearable readings with being awake. [Ohayon et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28346153/) |
| Regularity | A prospective study of 60,977 UK Biobank participants associated greater sleep regularity with lower mortality risk. | Include consistency as a separate dimension. This observational result does not prove causation, validate a nightly score or determine its weights. The study's Sleep Regularity Index compares sleep/wake states 24 hours apart; bedtime deviation is a simpler proxy, not that same index. [Windred et al., 2024](https://pubmed.ncbi.nlm.nih.gov/37738616/) |
| REM/deep sleep percentages | The NSF consensus found less or no agreement on sleep architecture as an indicator of good sleep quality. | Display stages as context; do not start by enforcing an invented ideal percentage in the score. [Ohayon et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28346153/) |

These sources support component selection. They do not validate a new composite score. The initial product is a descriptive wellness trend; clinical claims require a different validation standard. [AASM position statement](https://pmc.ncbi.nlm.nih.gov/articles/PMC5940440/)

## Apple-like candidate

Apple publishes the top-level split: duration up to 50 points, bedtime consistency up to 30, interruptions up to 20. Bedtime consistency considers the previous 13 nights; interruptions consider frequency and duration of awake periods. Apple does not publish the complete transformation from those inputs into points on this page. [Apple's explanation](https://support.apple.com/en-in/guide/watch/apded441a669/watchos)

Use that split as a first comparison model. Estimate three small, explainable component functions independently from reference examples. Prefer bounded monotonic piecewise-linear curves over a flexible model that memorizes one person's nights. Do not assume exact breakpoints, averaging method, rounding, treatment of naps, sleep-goal dependence or interruption-count rules before testing them.

- Duration: investigate points versus actual sleep minutes and the displayed goal. More sleep should not earn unbounded points.
- Consistency: investigate the displayed bedtime deviation first. Handle times around midnight with circular time differences. Do not impose a universal early bedtime.
- Interruptions: investigate awake minutes and meaningful awake episodes together. Adjacent HealthKit samples must not become separate awakenings by accident.

## First screenshot batch

Start with five to ten contrasting nights, rather than only high scores. Include a short night, a usual night, a late bedtime and an interrupted night where available.

For each night collect the date, total score, component points, total time asleep, bedtime consistency detail, and interruption detail. Expanded panels may require more than one screenshot. Record the current sleep goal and iOS/watchOS versions once. If older screenshots came from a different OS version or goal, preserve that distinction.

The displayed consistency deviation can avoid reconstructing the whole baseline for the initial fit. If unavailable, additional history may be required to test the previous-13-night calculation. Screenshots do not necessarily expose all internal inputs, and rounded labels may conceal small differences.

Extract a table for user review before fitting. Hold back at least two nights from the initial fit. Report component and total errors on held-out nights; do not fit to those examples and continue calling them held out. Later, seek consented examples from other people before claiming general accuracy. Do not ask anyone to change sleep to generate test cases.

## Implementation conditions

- Preserve imported Health provenance and the existing exclusion from external AI processing.
- Merge overlapping samples and select sources consistently; phone, Watch and other apps must not double-count the same sleep.
- Distinguish recorded awake time from missing data, watch removal and permission denial. Missing data must not produce a zero score or invented perfect continuity.
- Associate the score with its sleep session and wake date, including timezone; do not cut an overnight session at midnight. Handle daylight-saving transitions, naps and split sleep explicitly.
- Show component measurements while insufficient history prevents a comparable full score. Do not silently redistribute missing component weights.
- Keep raw measurements, computed components, algorithm version and total so changes remain auditable. Use a numeric 0–100 metric type rather than the existing 1–5 personal-rating UI.
- Test data handling and score behavior separately. Check duplicate imports, missing segments, unusual schedules and updates to previously imported sleep before release.

## Status

The deterministic V0 is now implemented locally alongside the Expo HealthKit bridge, workout matching drawer and Sleep score metric. See [implementation, formula, validation and limits](native-health-v0.md). No reference examples have been supplied and no Apple-equivalence or clinical validation is claimed. Combined native simulator compilation and local tests passed. Build 26 and production services have not been updated with V0.
