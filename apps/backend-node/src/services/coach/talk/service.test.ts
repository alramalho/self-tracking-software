import { describe, expect, it } from "vitest";
import { settleTurn } from "./service";
import { talkRequestSchema } from "./schema";
import type { CoachTurn } from "./types";

const TODAY = "2026-11-05";
const turn = (over: Partial<CoachTurn> = {}): CoachTurn => ({
  say: "When are you back?",
  detail: "",
  ask: "text",
  placeholder: "Sunday night",
  action: "none",
  until: "",
  checkAt: "",
  ...over,
});
const request = (over: object = {}) => talkRequestSchema.parse({ reason: "travel", ...over });

describe("settleTurn", () => {
  it("lets the coach ask its first question", () => {
    const { shown, quiet } = settleTurn(turn(), request(), TODAY);
    expect(shown).toMatchObject({ ask: "text", placeholder: "Sunday night", quietUntil: null });
    expect(quiet).toBeNull();
  });

  it("never asks a third question", () => {
    const asked = [
      { say: "When are you back?", answer: "not sure" },
      { say: "Roughly which day?", answer: "maybe Monday" },
    ];
    const { shown } = settleTurn(turn(), request({ turns: asked }), TODAY);
    expect(shown.ask).toBe("none");
    expect(shown.placeholder).toBe("");
  });

  it("quiets the plan until the return day the coach read", () => {
    const { shown, quiet } = settleTurn(
      turn({ say: "Quiet until Monday.", ask: "none", action: "quiet", until: "2026-11-09" }),
      request({ turns: [{ say: "When are you back?", answer: "back sunday night" }] }),
      TODAY,
    );
    expect(shown.quietUntil).toBe("2026-11-09");
    expect(quiet).toEqual({ until: "2026-11-09", why: "away" });
  });

  it("drops a quiet day in the past or beyond a month, so the alert is only answered for today", () => {
    for (const until of ["2026-11-01", "2027-01-30", "monday"]) {
      const { shown, quiet } = settleTurn(turn({ ask: "none", action: "quiet", until }), request(), TODAY);
      expect(quiet).toEqual({ until: TODAY, why: "answered" });
      expect(shown.quietUntil).toBeNull();
    }
  });

  it("a named day ends the conversation with a commitment the coach checks on", () => {
    const { shown, quiet, commitDay, over } = settleTurn(
      turn({ say: "Today then.", ask: "text", action: "commit", until: TODAY }),
      request({ reason: "motivation", turns: [{ say: "When's the next one?", answer: "today" }] }),
      TODAY,
    );
    expect(over).toBe(true);
    expect(shown.ask).toBe("none");
    expect(shown.quietUntil).toBeNull();
    expect(commitDay).toBe(TODAY);
    expect(quiet).toEqual({ until: TODAY, why: "committed" });
  });

  it("a commitment books the time the coach picked, and the screen says the booked time", () => {
    const times = { earliestToday: "12:30", latest: "22:00", usual: "20:00" };
    const said = settleTurn(
      turn({ say: "Today then. I'll check in at 21:30.", ask: "none", action: "commit", until: TODAY, checkAt: "21:30" }),
      request({ reason: "motivation" }),
      TODAY,
      times,
    );
    expect(said.shown.commitment).toEqual({ day: TODAY, checkAt: "21:30" });
    const moved = settleTurn(
      turn({ say: "Today then. I'll check in at 12:00.", ask: "none", action: "commit", until: TODAY, checkAt: "12:00" }),
      request({ reason: "motivation" }),
      TODAY,
      times,
    );
    expect(moved.shown).toMatchObject({ say: "Today then. I'll check in at 12:30.", commitment: { day: TODAY, checkAt: "12:30" } });
  });

  it("a commitment more than a week out is not kept", () => {
    const { commitDay, quiet } = settleTurn(turn({ ask: "none", action: "commit", until: "2026-11-20" }), request(), TODAY);
    expect(commitDay).toBeNull();
    expect(quiet).toEqual({ until: TODAY, why: "answered" });
  });

  it("a conversation that ends without a day still answers the alert for today", () => {
    const { quiet, over } = settleTurn(turn({ say: "Got it.", ask: "none" }), request({ reason: "busy" }), TODAY);
    expect(over).toBe(true);
    expect(quiet).toEqual({ until: TODAY, why: "answered" });
  });

  it("the last screen never asks a question", () => {
    const { shown } = settleTurn(
      turn({ say: "Travel can disrupt the routine. When are you back?", detail: "", ask: "text" }),
      request({ notSure: true }),
      TODAY,
    );
    expect(shown).toMatchObject({ say: "Travel can disrupt the routine.", ask: "none" });
    const onlyQuestion = settleTurn(turn({ say: "When are you back?", detail: "I'll ask again Sunday." }), request({ notSure: true }), TODAY);
    expect(onlyQuestion.shown).toMatchObject({ say: "I'll ask again Sunday.", detail: "" });
  });

  it("'Not sure yet' always says when the coach asks again", () => {
    const { shown } = settleTurn(turn({ say: "Travel can shift the rhythm.", detail: "Counting on you." }), request({ notSure: true }), TODAY);
    expect(shown.detail).toBe("Counting on you. I'll ask again Sunday.");
  });

  it("a question keeps the conversation open", () => {
    expect(settleTurn(turn(), request(), TODAY).over).toBe(false);
  });

  it("'Not sure yet' always ends with asking again in three days", () => {
    const { shown, quiet } = settleTurn(turn({ ask: "text", action: "none" }), request({ notSure: true }), TODAY);
    expect(shown.ask).toBe("none");
    expect(quiet).toEqual({ until: "2026-11-08", why: "not_sure" });
    expect(shown.quietUntil).toBeNull();
  });

  it("keeps lines short", () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    const { shown } = settleTurn(turn({ say: long, detail: long }), request(), TODAY);
    expect(shown.say.split(" ")).toHaveLength(12);
    expect(shown.detail.split(" ")).toHaveLength(30);
  });

  it("turns semicolons into full stops", () => {
    const { shown } = settleTurn(turn({ say: "Motivation slipped; when is your next session?" }), request(), TODAY);
    expect(shown.say).toBe("Motivation slipped. When is your next session?");
  });
});
