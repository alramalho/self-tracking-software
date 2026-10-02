# Private coaching walkthrough

Serve this directory and open it in a browser:

```sh
python3 -m http.server 8764 --bind 127.0.0.1 --directory docs/reviews/coaching
```

- `index.html`, `review.js`, `review.css`: the page. It makes no network calls.
- `screens/`: Expo web captures at 390 × 844 from the local E2E fixture API (not iPhone device captures). `seed.mjs` prepares the running/meditation examples on the fixture account (`proposal`, `training`, `baseline`, `weekly`, `session`, `silence`, `paused`, `preparing`). Recapturing needs the fixture server and the Expo web preview running.
- `model-comparison.json`: raw output of `apps/backend-node/scripts/coach-monitoring/compare-models.cjs` (synthetic cases through the real scheduled-coach prompts). Rerun it with a Gateway key file:

```sh
cd apps/backend-node
COACH_GATEWAY_KEY_FILE=/path/to/key-file.md COACH_OUTPUT=../../docs/reviews/coaching/model-comparison.json node --import tsx scripts/coach-monitoring/compare-models.cjs
```

The key stays in memory; never copy it into the repository. No public hosting or production deployment was done from this page.
