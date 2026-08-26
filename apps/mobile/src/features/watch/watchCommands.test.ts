import { describe, expect, it } from "vite-plus/test";

import { parseWatchCommand, serializeWatchCommandResult } from "./watchCommands";

describe("parseWatchCommand", () => {
  it("accepts every command the watch app sends", () => {
    expect(
      parseWatchCommand(
        JSON.stringify({
          type: "respondToApproval",
          commandId: "c1",
          environmentId: "env",
          threadId: "thread",
          requestId: "req",
          decision: "acceptForSession",
        }),
      ),
    ).toMatchObject({ type: "respondToApproval", decision: "acceptForSession" });
    expect(
      parseWatchCommand(
        JSON.stringify({
          type: "respondToUserInput",
          commandId: "c2",
          environmentId: "env",
          threadId: "thread",
          requestId: "req",
          answers: { q1: "Web", q2: ["A", "B"] },
        }),
      ),
    ).toMatchObject({ type: "respondToUserInput", answers: { q1: "Web", q2: ["A", "B"] } });
    expect(
      parseWatchCommand(
        JSON.stringify({
          type: "sendMessage",
          commandId: "c3",
          environmentId: "env",
          threadId: "thread",
          text: "Full steam ahead",
        }),
      ),
    ).toMatchObject({ type: "sendMessage", text: "Full steam ahead" });
    expect(
      parseWatchCommand(
        JSON.stringify({
          type: "interruptTurn",
          commandId: "c4",
          environmentId: "env",
          threadId: "thread",
        }),
      ),
    ).toMatchObject({ type: "interruptTurn" });
    expect(parseWatchCommand(JSON.stringify({ type: "requestSnapshot" }))).toEqual({
      type: "requestSnapshot",
    });
  });

  it("rejects malformed input rather than throwing", () => {
    expect(parseWatchCommand("not json")).toBeNull();
    expect(parseWatchCommand(JSON.stringify({ type: "sendMessage" }))).toBeNull();
    expect(
      parseWatchCommand(
        JSON.stringify({
          type: "respondToApproval",
          commandId: "c1",
          environmentId: "env",
          threadId: "thread",
          requestId: "req",
          decision: "maybe",
        }),
      ),
    ).toBeNull();
  });

  it("serializes results the watch decoder expects", () => {
    expect(
      JSON.parse(
        serializeWatchCommandResult({
          type: "commandResult",
          commandId: "c1",
          ok: false,
          error: "x",
        }),
      ),
    ).toEqual({ type: "commandResult", commandId: "c1", ok: false, error: "x" });
  });
});
