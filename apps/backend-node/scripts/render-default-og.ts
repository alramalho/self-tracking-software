// Draws the default link-preview image (the one every page except circle invites uses)
// with the same code as the circle invite previews, and saves it into the web app.
// Run from apps/backend-node: pnpm exec tsx scripts/render-default-og.ts
import { writeFileSync } from "node:fs";
import path from "node:path";
import { APP_CARD } from "../src/services/og/card";
import { renderOgCard } from "../src/services/og/render";

const target = path.join(__dirname, "../../frontend-vite/public/images/og.png");

renderOgCard(APP_CARD).then((png) => {
  writeFileSync(target, png);
  console.log(`Wrote ${target} (${Math.round(png.length / 1024)} KB)`);
});
