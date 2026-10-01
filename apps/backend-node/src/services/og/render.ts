import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { OG_HEIGHT, OG_WIDTH, ogCard, type OgCard, type OgImages } from "./card";

const ASSETS = path.join(__dirname, "../../../assets/og");
const TWEMOJI = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";
const CACHE_MINUTES = 10;
const CACHE_SIZE = 200;

// How the renderer reaches the network; tests pass their own.
export interface OgLoaders {
  // An emoji as an image data URI, or null to leave it out.
  emoji: (emoji: string) => Promise<string | null>;
  // A profile photo as a small square data URI, or null to show the initial instead.
  photo: (url: string) => Promise<string | null>;
}

const dataUri = (type: string, data: Buffer) => `data:${type};base64,${data.toString("base64")}`;

// Fonts and art are read on the first render, so a missing file fails one image, not the server.
let assets: { fonts: { name: string; data: Buffer; weight: 400 | 700 }[]; images: OgImages } | null =
  null;
function loadAssets() {
  const file = (name: string) => readFileSync(path.join(ASSETS, name));
  const png = (name: string) => dataUri("image/png", file(name));
  assets ??= {
    fonts: [
      { name: "Inter", data: file("Inter-Regular.ttf"), weight: 400 },
      { name: "Inter", data: file("Inter-Bold.ttf"), weight: 700 },
    ],
    images: {
      icon: png("app-icon.png"),
      circle: png("circle.png"),
      start: png("start.png"),
      welcome: png("welcome.png"),
    },
  };
  return assets;
}

// Twemoji names its files after the code points, without the variation selector
// unless the emoji is a joined sequence.
function twemojiFile(emoji: string): string {
  const plain = emoji.includes("‍") ? emoji : emoji.replace(/️/g, "");
  return [...plain].map((char) => char.codePointAt(0)!.toString(16)).join("-");
}

const emojiCache = new Map<string, string>();
async function twemoji(emoji: string): Promise<string | null> {
  const file = twemojiFile(emoji);
  const cached = emojiCache.get(file);
  if (cached) return cached;
  try {
    const response = await fetch(`${TWEMOJI}/${file}.svg`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const uri = dataUri("image/svg+xml", Buffer.from(await response.arrayBuffer()));
    emojiCache.set(file, uri);
    return uri;
  } catch {
    return null;
  }
}

async function memberPhoto(url: string): Promise<string | null> {
  // Profile photos live on our storage or the sign-in provider; nothing else is fetched.
  if (!url.startsWith("https://")) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .rotate()
      .resize(172, 172, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return dataUri("image/jpeg", jpeg);
  } catch {
    return null;
  }
}

// Circle previews are 12 px JPEGs: enlarged smoothly here so the squares don't look pixelated.
async function softSquare(preview: string): Promise<string | null> {
  try {
    const jpeg = await sharp(Buffer.from(preview.slice(preview.indexOf(",") + 1), "base64"))
      .resize(184, 184, { kernel: "cubic" })
      .blur(8)
      .jpeg({ quality: 80 })
      .toBuffer();
    return dataUri("image/jpeg", jpeg);
  } catch {
    return null;
  }
}

function withoutEmoji(text: string, emoji: string[]): string {
  const stripped = emoji.reduce((rest, one) => rest.split(one).join(""), text);
  return stripped.replace(/ {2,}/g, " ").trim();
}

export async function renderOgCard(
  card: OgCard,
  loaders: OgLoaders = { emoji: twemoji, photo: memberPhoto },
): Promise<Buffer> {
  const { fonts, images } = loadAssets();
  const [previews, members] = await Promise.all([
    Promise.all(card.previews.map(softSquare)),
    Promise.all(
      (card.orbit?.members ?? []).map(async (member) => ({
        ...member,
        picture: member.picture ? await loaders.photo(member.picture) : null,
      })),
    ),
  ]);
  const ready: OgCard = {
    ...card,
    previews: previews.filter((square): square is string => !!square),
    orbit: card.orbit && { ...card.orbit, members },
  };

  // Satori asks for anything the fonts can't draw; we only help with emoji.
  const missing: string[] = [];
  const draw = (drawn: OgCard) =>
    // Satori's types expect React nodes, but it takes plain element objects too.
    satori(ogCard(drawn, images) as any, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts,
      loadAdditionalAsset: async (kind, segment) => {
        if (kind !== "emoji") return [];
        const emoji = await loaders.emoji(segment);
        if (!emoji) missing.push(segment);
        return emoji ?? [];
      },
    });
  let svg = await draw(ready);
  // An emoji that couldn't be loaded would show as an empty box, so draw again without it.
  if (missing.length) {
    const strip = (text: string) => withoutEmoji(text, missing);
    svg = await draw({ ...ready, title: strip(ready.title), kicker: ready.kicker && strip(ready.kicker) });
  }
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Crawlers fetch the same preview in bursts; the key changes when the card would.
const rendered = new Map<string, { png: Buffer; expires: number }>();
export async function cachedOgCard(key: string, card: OgCard): Promise<Buffer> {
  const hit = rendered.get(key);
  if (hit && hit.expires > Date.now()) return hit.png;
  const png = await renderOgCard(card);
  rendered.delete(key);
  if (rendered.size >= CACHE_SIZE) rendered.delete(rendered.keys().next().value!);
  rendered.set(key, { png, expires: Date.now() + CACHE_MINUTES * 60_000 });
  return png;
}
