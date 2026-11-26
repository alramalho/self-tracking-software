import { describe, expect, it } from "vitest";
import { fullerTranscript, withoutWhisperFiller } from "./coverage";

// Real replays of stored voice notes (26 Nov 2026): gpt-4o-transcribe first, Whisper large-v3 second.
describe("fullerTranscript", () => {
  it("keeps the part gpt-4o-transcribe dropped (26 Nov backfill note)", () => {
    const kept = fullerTranscript(
      "I've been doing Chinese daily for like 90 minutes.",
      " I've been doing Chinese daily for like 90 minutes  the one or the ones that i did not fill in fill it into",
    );
    expect(kept.usedCheck).toBe(true);
    expect(kept.text).toContain("did not fill in");
  });

  it("keeps the first half gpt-4o-transcribe dropped (21 Nov Chinese + gym)", () => {
    const kept = fullerTranscript(
      "I just went for the gym right now.",
      " Yeah, mark that I did my Chinese lessons yesterday for about 45 minutes and I just went for the gym right now.",
    );
    expect(kept.usedCheck).toBe(true);
  });

  it("drops Whisper's sound labels when it uses Whisper (20 Nov)", () => {
    const kept = fullerTranscript(
      "I did do the Chinese yesterday, probably around two lessons, around four hours, and it was focused on greetings, cell phone numbers.",
      " i did do the chinese yesterday probably around two lessons around four hours and it was focused on  Uh...  greetings cell phone numbers  *gunshots*  Yeah, numbers and cell phone numbers.",
    );
    expect(kept.usedCheck).toBe(true);
    expect(kept.text).not.toContain("gunshots");
  });

  it("keeps gpt-4o-transcribe when both heard the same note in other words", () => {
    expect(
      fullerTranscript(
        "Mark that I just went to the gym, it felt good. I don't think it energized me much but it felt necessary.",
        " Mark that I've just went to the gym and it felt good. I don't think it energized me much, but it felt necessary.",
      ).usedCheck,
    ).toBe(false);
    expect(fullerTranscript("Excellent, this made me feel really energetic.", " Excellent.  It was really energetic.").usedCheck).toBe(false);
    expect(fullerTranscript("Chinese flashcards.", "Chinese flashcards").usedCheck).toBe(false);
  });

  it("never prefers Whisper's filler on silence", () => {
    expect(fullerTranscript("", " Thank you.").usedCheck).toBe(false);
    expect(withoutWhisperFiller(" Thank you. ")).toBe("");
  });
});
