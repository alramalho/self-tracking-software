import { describe, expect, it } from "vitest";
import type { CircleCard } from "../circles/types";
import { inviteCacheKey, inviteMeta, inviteOgCard, shortName } from "./circleInvite";

const person = (name: string | null, picture: string | null = null) => ({ name, goal: "Run a 10K", picture });

const card = (changes: Partial<CircleCard> = {}): CircleCard => ({
  id: "circle",
  name: "Morning 10K",
  emoji: "🏃",
  status: "ACTIVE",
  place: "Lisbon",
  memberCount: 4,
  paceLabel: "3–4 a week",
  logsThisWeek: 14,
  previews: ["data:image/jpeg;base64,AA==", "data:image/jpeg;base64,AA=="],
  morePhotos: 0,
  reasons: [],
  members: [person("Rita", "https://example.test/rita.jpg"), person("Tomás"), person("joão"), person(null)],
  ...changes,
});

const forming = (changes: Partial<CircleCard> = {}) =>
  card({ status: "FORMING", memberCount: 1, logsThisWeek: 1, members: [person("Rita")], ...changes });

describe("circle invite preview", () => {
  it("shows who invited you, the circle, its pace and place, and the week's proof", () => {
    expect(inviteOgCard({ card: card(), owner: "Rita" })).toEqual({
      art: "circle",
      kicker: "Rita invited you to a circle",
      title: "🏃 Morning 10K",
      sub: "3–4 a week · Lisbon",
      previews: card().previews,
      meta: "14 sessions posted this week · 4 of 8 spots",
      orbit: {
        members: [
          { initial: "R", picture: "https://example.test/rita.jpg" },
          { initial: "T", picture: null },
          { initial: "J", picture: null },
          { initial: "?", picture: null },
        ],
        openSpots: 1,
      },
    });
  });

  it("asks you to be one of the first while fewer than two people have posted", () => {
    const og = inviteOgCard({ card: forming(), owner: "Rita" });
    expect(og).toMatchObject({
      art: "start",
      kicker: "Rita started a circle",
      previews: [],
      meta: "Be one of the first. Post a photo to join.",
    });
    expect(og.orbit).toEqual({ members: [{ initial: "R", picture: null }], openSpots: 3 });
  });

  it("counts sessions in the singular and leaves them out when there are none", () => {
    const meta = (logsThisWeek: number) => inviteOgCard({ card: card({ logsThisWeek }), owner: "Rita" }).meta;
    expect(meta(1)).toBe("1 session posted this week · 4 of 8 spots");
    expect(meta(0)).toBe("4 of 8 spots");
  });

  it("leaves out the pace or the place when unknown, and the open spot when full", () => {
    const og = (changes: Partial<CircleCard>) => inviteOgCard({ card: card(changes), owner: "Rita" });
    expect(og({ place: null }).sub).toBe("3–4 a week");
    expect(og({ paceLabel: null }).sub).toBe("Lisbon");
    expect(og({ paceLabel: null, place: null }).sub).toBeNull();
    expect(og({ memberCount: 8 }).orbit?.openSpots).toBe(0);
  });

  it("cuts a long circle name with an ellipsis", () => {
    const long = "Run a 10K under 50 min · Vila Nova de Gaia e arredores";
    expect(shortName(long)).toBe("Run a 10K under 50 min · Vila Nov…");
    expect([...shortName(long)]).toHaveLength(34);
    expect(shortName("  Morning 10K ")).toBe("Morning 10K");
    expect(inviteOgCard({ card: card({ name: long }), owner: "Rita" }).title).toBe(
      "🏃 Run a 10K under 50 min · Vila Nov…",
    );
  });

  it("writes the page title and description for an active and a forming circle", () => {
    expect(inviteMeta({ card: card(), owner: "Rita" })).toEqual({
      title: "Join 🏃 Morning 10K",
      description: "Rita and 3 others are in. Post a photo from a session to join.",
    });
    expect(inviteMeta({ card: card({ memberCount: 2 }), owner: "Rita" }).description).toBe(
      "Rita and 1 other are in. Post a photo from a session to join.",
    );
    expect(inviteMeta({ card: forming(), owner: "A friend" }).description).toBe(
      "A friend started this circle. Be one of the first: post a photo from a session to join.",
    );
  });

  it("renders again only when the name, the members or the week's sessions change", () => {
    expect(inviteCacheKey("code", card())).toBe("code|Morning 10K|4|14");
  });
});
