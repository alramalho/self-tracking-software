import { describe, expect, it } from "vitest";
import { draftsFromRawText } from "./draftGuards";

describe("draftsFromRawText", () => {
  it("keeps ordinary text as one message", () => {
    expect(draftsFromRawText("Nice, see you Saturday.")).toEqual([
      { content: "Nice, see you Saturday." },
    ]);
  });

  it("reads tool arguments the model wrote as text, ignoring stray tokens after them", () => {
    const text =
      '{"messages":[{"requiresReply":true,"content":"Understood, Alex. Which course?"}]} ꦏꦺ';
    expect(draftsFromRawText(text)).toEqual([
      { content: "Understood, Alex. Which course?", requiresReply: true },
    ]);
  });

  it("reads fenced JSON and bare arrays", () => {
    expect(draftsFromRawText('```json\n[{"content":"Hi"},{"content":"Two"}]\n```')).toEqual([
      { content: "Hi", requiresReply: false },
      { content: "Two", requiresReply: false },
    ]);
  });

  it("refuses JSON it can't read so the coach retries", () => {
    expect(draftsFromRawText('{"messages":[{"content":"cut off')).toBeNull();
    expect(draftsFromRawText('{"foo":1}')).toBeNull();
  });
});
