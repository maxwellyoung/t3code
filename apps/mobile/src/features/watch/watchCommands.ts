import { ProviderApprovalDecision } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

/**
 * Commands the watch app sends over Watch Connectivity. Mirrors
 * `targets/watch/WatchModels.swift`; both sides validate, neither trusts the
 * other's shape.
 */
const RespondToApprovalCommand = Schema.Struct({
  type: Schema.Literal("respondToApproval"),
  commandId: Schema.String,
  environmentId: Schema.String,
  threadId: Schema.String,
  requestId: Schema.String,
  decision: ProviderApprovalDecision,
});

const SendMessageCommand = Schema.Struct({
  type: Schema.Literal("sendMessage"),
  commandId: Schema.String,
  environmentId: Schema.String,
  threadId: Schema.String,
  text: Schema.String,
});

const RespondToUserInputCommand = Schema.Struct({
  type: Schema.Literal("respondToUserInput"),
  commandId: Schema.String,
  environmentId: Schema.String,
  threadId: Schema.String,
  requestId: Schema.String,
  // Question id → selected option label(s) or a free-text answer, the same
  // shape the phone composer submits.
  answers: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Array(Schema.String)])),
});

const InterruptTurnCommand = Schema.Struct({
  type: Schema.Literal("interruptTurn"),
  commandId: Schema.String,
  environmentId: Schema.String,
  threadId: Schema.String,
});

const RequestSnapshotCommand = Schema.Struct({
  type: Schema.Literal("requestSnapshot"),
});

export const WatchCommand = Schema.Union([
  RespondToApprovalCommand,
  RespondToUserInputCommand,
  SendMessageCommand,
  InterruptTurnCommand,
  RequestSnapshotCommand,
]);
export type WatchCommand = typeof WatchCommand.Type;

const isWatchCommand = Schema.is(WatchCommand);

export function parseWatchCommand(json: string): WatchCommand | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  return isWatchCommand(value) ? value : null;
}

export interface WatchCommandResult {
  readonly type: "commandResult";
  readonly commandId: string;
  readonly ok: boolean;
  readonly error: string | null;
}

export function serializeWatchCommandResult(result: WatchCommandResult): string {
  return JSON.stringify(result);
}
