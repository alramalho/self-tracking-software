import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { APP_CARD, type OgCard } from "./card";
import { renderOgCard } from "./render";

// Stand-ins for the network: a tiny emoji drawing and a plain square photo.
const emojiImage = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#f4900c"/></svg>',
).toString("base64")}`;

async function square(size: number): Promise<string> {
  const jpeg = await sharp({ create: { width: size, height: size, channels: 3, background: "#7c9" } })
    .jpeg()
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function inviteCard(): Promise<OgCard> {
  const preview = await square(12);
  return {
    art: "circle",
    kicker: "Rita invited you to a circle",
    title: "🏃 Morning 10K",
    sub: "3–4 a week · Lisbon",
    previews: [preview, preview, preview, preview],
    meta: "14 sessions posted this week · 4 of 8 spots",
    orbit: {
      members: [
        { initial: "R", picture: "https://example.test/rita.jpg" },
        { initial: "T", picture: null },
        { initial: "J", picture: "https://example.test/gone.jpg" },
        { initial: "M", picture: null },
      ],
      openSpots: 1,
    },
  };
}

async function expectPreviewImage(png: Buffer) {
  expect(await sharp(png).metadata()).toMatchObject({ format: "png", width: 1200, height: 630 });
}

describe("link preview image", () => {
  it("draws a circle invite as a 1200x630 PNG, loading its emoji and member photos", async () => {
    const photo = await square(200);
    const loaders = {
      emoji: vi.fn(async () => emojiImage),
      photo: vi.fn(async (url: string) => (url.endsWith("rita.jpg") ? photo : null)),
    };
    await expectPreviewImage(await renderOgCard(await inviteCard(), loaders));
    expect(loaders.emoji).toHaveBeenCalledWith("🏃");
    expect(loaders.photo.mock.calls.map(([url]) => url)).toEqual([
      "https://example.test/rita.jpg",
      "https://example.test/gone.jpg",
    ]);
  });

  it("still draws the card when the emoji and the photos can't be loaded", async () => {
    const offline = { emoji: vi.fn(async () => null), photo: async () => null };
    await expectPreviewImage(await renderOgCard(await inviteCard(), offline));
    // Asked once: the second drawing has no emoji left to ask for.
    expect(offline.emoji).toHaveBeenCalledTimes(1);
  });

  it("draws the default app card without touching the network", async () => {
    const loaders = { emoji: vi.fn(async () => null), photo: vi.fn(async () => null) };
    await expectPreviewImage(await renderOgCard(APP_CARD, loaders));
    expect(loaders.emoji).not.toHaveBeenCalled();
    expect(loaders.photo).not.toHaveBeenCalled();
  });
});
