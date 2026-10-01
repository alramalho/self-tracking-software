// The link-preview card (1200x630) as a satori element tree. One layout for the three
// variants: an active circle invite, a forming circle invite and the default app card.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const INK = "#0b0d12";
const MUTED = "#6b7280";
const ACCENT = "#2563eb";
const TINT = "#eaf1fe";
const ORBIT = "#a9bde8";
const WHITE = "#ffffff";

export type OgArt = "circle" | "start" | "welcome";

export interface OgMember {
  initial: string;
  // A URL until the renderer swaps it for a data URI (or null when it can't be loaded).
  picture: string | null;
}

export interface OgCard {
  art: OgArt;
  kicker: string | null;
  // "\n" starts a new line.
  title: string;
  sub: string | null;
  // Blurred photo squares, as data URIs.
  previews: string[];
  meta: string;
  // Circle cards only: who sits on the dashed orbit, and how many "+" open spots.
  orbit: { members: OgMember[]; openSpots: number } | null;
}

// Everything that isn't a circle invite: the home page, profiles, /join.
export const APP_CARD: OgCard = {
  art: "welcome",
  kicker: null,
  title: "Get on track,\ntogether.",
  sub: "A plan, a coach, and a circle that shows up with you.",
  previews: [],
  meta: "Free · iPhone and web",
  orbit: null,
};

// The app icon and the clay art, as data URIs.
export type OgImages = Record<"icon" | OgArt, string>;

export interface OgNode {
  type: string;
  props: Record<string, unknown>;
}

type Style = Record<string, string | number>;

const box = (style: Style, children?: OgNode[] | string): OgNode => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

const image = (src: string, size: number, style: Style = {}): OgNode => ({
  type: "img",
  props: { src, width: size, height: size, style },
});

// Places a round thing by its centre, like the mockup's cx/cy.
const centred = (x: number, y: number, size: number): Style => ({
  position: "absolute",
  left: x - size / 2,
  top: y - size / 2,
  width: size,
  height: size,
  borderRadius: size / 2,
});

// Where people sit on the orbit, in order.
const SEATS = [
  [720, 245],
  [1090, 235],
  [1109, 374],
  [711, 374],
] as const;
const BOTTOM_SEAT = [910, 455] as const;
export const ORBIT_SEATS = SEATS.length;
const SEAT_COLOURS = ["#e0527d", "#d97706", "#0f9f6e", "#7c5cff"];

function memberSeat(member: OgMember, index: number): OgNode {
  const [x, y] = SEATS[index];
  const ring = { ...centred(x, y, 86), border: `6px solid ${WHITE}` };
  if (member.picture) return image(member.picture, 86, { ...ring, objectFit: "cover" });
  return box(
    {
      ...ring,
      backgroundColor: SEAT_COLOURS[index],
      color: WHITE,
      fontSize: 34,
      fontWeight: 700,
      alignItems: "center",
      justifyContent: "center",
    },
    member.initial,
  );
}

const openSeat = ([x, y]: readonly [number, number]): OgNode =>
  box(
    {
      ...centred(x, y, 79),
      border: `3px dashed ${ORBIT}`,
      backgroundColor: WHITE,
      color: MUTED,
      fontSize: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    "+",
  );

function rightSide(card: OgCard, images: OgImages): OgNode[] {
  if (!card.orbit) {
    return [
      box({ ...centred(930, 330, 400), backgroundColor: TINT }),
      image(images[card.art], 300, { position: "absolute", left: 780, top: 180 }),
    ];
  }
  const members = card.orbit.members.slice(0, ORBIT_SEATS);
  // A single open spot sits at the bottom of the orbit; a forming circle's spots take the empty seats.
  const open =
    card.orbit.openSpots === 1
      ? [BOTTOM_SEAT]
      : SEATS.slice(members.length, members.length + card.orbit.openSpots);
  return [
    box({ ...centred(910, 315, 352), backgroundColor: TINT }),
    box({
      position: "absolute",
      left: 690,
      top: 175,
      width: 440,
      height: 280,
      borderRadius: "50%",
      border: `3px dashed ${ORBIT}`,
    }),
    image(images[card.art], 240, { position: "absolute", left: 790, top: 195 }),
    ...members.map(memberSeat),
    ...open.map(openSeat),
  ];
}

// Long circle names get a smaller title so two lines still clear the art on the right.
function titleSize(card: OgCard): number {
  if (!card.orbit) return 88;
  return card.title.length > 14 ? 60 : 76;
}

function leftSide(card: OgCard): OgNode {
  const size = titleSize(card);
  const rows: OgNode[] = [];
  if (card.kicker) rows.push(box({ color: ACCENT, fontSize: 30, marginBottom: 12 }, card.kicker));
  rows.push(
    box(
      {
        display: "block",
        lineClamp: 2,
        whiteSpace: "pre-wrap",
        color: INK,
        fontSize: size,
        fontWeight: 700,
        lineHeight: card.orbit ? 1.12 : 0.96,
        letterSpacing: -size / 30,
      },
      card.title,
    ),
  );
  if (card.sub) {
    rows.push(box({ color: MUTED, fontSize: 32, lineHeight: 1.3, marginTop: 18 }, card.sub));
  }
  if (card.previews.length) {
    rows.push(
      box(
        { marginTop: 36, gap: 14 },
        card.previews.slice(0, 4).map((src) => image(src, 92, { borderRadius: 18, objectFit: "cover" })),
      ),
    );
  }
  rows.push(
    box({ color: MUTED, fontSize: 26, marginTop: card.previews.length ? 28 : 64 }, card.meta),
  );
  return box(
    {
      position: "absolute",
      left: 64,
      top: 140,
      width: 590,
      height: 470,
      flexDirection: "column",
      justifyContent: "center",
    },
    rows,
  );
}

export function ogCard(card: OgCard, images: OgImages): OgNode {
  return box(
    {
      position: "relative",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      backgroundColor: WHITE,
      fontFamily: "Inter",
    },
    [
      box({ position: "absolute", left: 64, top: 56, alignItems: "center" }, [
        image(images.icon, 52),
        box(
          { marginLeft: 16, color: INK, fontSize: 32, fontWeight: 700, letterSpacing: -0.5 },
          "tracking.so",
        ),
      ]),
      leftSide(card),
      ...rightSide(card, images),
    ],
  );
}
