import {
  ApprovalRequestId,
  CommandId,
  EnvironmentId,
  MessageId,
  ThreadId,
} from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { makeQueuedMessageMetadata } from "../../lib/commandMetadata";
import { scopedThreadKey } from "../../lib/scopedEntities";
import {
  derivePendingApprovals,
  derivePendingUserInputs,
  sortThreadActivities,
} from "../../lib/threadActivity";
import { useProjects, useThreadShells } from "../../state/entities";
import { threadEnvironment, useEnvironmentThread } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { resolveWatchBridge } from "./watchBridgeModule";
import { parseWatchCommand, serializeWatchCommandResult, type WatchCommand } from "./watchCommands";
import {
  buildWatchSnapshotBody,
  serializeWatchSnapshot,
  type PendingThreadRequests,
} from "./watchSnapshot";

type RequestsByThreadKey = Readonly<Record<string, PendingThreadRequests>>;

/**
 * Mounts once at the app root. Pushes the agent-awareness list to the paired
 * Apple Watch and executes the commands it sends back. Renders nothing.
 */
export function WatchBridgeHost() {
  // Module availability is fixed for the process lifetime, so the early
  // return never changes hook order across renders.
  if (resolveWatchBridge() === null) {
    return null;
  }
  return <WatchBridge />;
}

function WatchBridge() {
  const shells = useThreadShells();
  const projects = useProjects();
  const [requestsByThreadKey, setRequestsByThreadKey] = useState<RequestsByThreadKey>({});
  const respondToApproval = useAtomCommand(threadEnvironment.respondToApproval, {
    label: "watch approval response",
    reportFailure: false,
  });
  const respondToUserInput = useAtomCommand(threadEnvironment.respondToUserInput, {
    label: "watch user input response",
    reportFailure: false,
  });
  const startTurn = useAtomCommand(threadEnvironment.startTurn, {
    label: "watch reply",
    reportFailure: false,
  });
  const interruptTurn = useAtomCommand(threadEnvironment.interruptTurn, {
    label: "watch interrupt",
    reportFailure: false,
  });

  const requestShells = useMemo(
    () =>
      shells.filter(
        (shell) =>
          (shell.hasPendingApprovals || shell.hasPendingUserInput) && shell.archivedAt === null,
      ),
    [shells],
  );

  const onRequestsChange = useCallback((key: string, requests: PendingThreadRequests | null) => {
    setRequestsByThreadKey((current) => {
      if (requests === null) {
        if (!(key in current)) {
          return current;
        }
        const { [key]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [key]: requests };
    });
  }, []);

  const body = useMemo(
    () => buildWatchSnapshotBody({ shells, projects, requestsByThreadKey }),
    [projects, requestsByThreadKey, shells],
  );
  const bodyJson = useMemo(() => JSON.stringify(body), [body]);
  const lastSentBodyRef = useRef<string | null>(null);

  const pushSnapshot = useCallback(
    (force: boolean) => {
      const bridge = resolveWatchBridge();
      if (bridge === null) {
        return;
      }
      if (!force && lastSentBodyRef.current === bodyJson) {
        return;
      }
      try {
        bridge.updateSnapshot(serializeWatchSnapshot(body, new Date().toISOString()));
        lastSentBodyRef.current = bodyJson;
      } catch (error) {
        // Application context fails before the session activates or without a
        // paired watch; the next change or reachability event retries.
        console.warn("[watch-bridge] snapshot update failed", error);
      }
    },
    [body, bodyJson],
  );

  useEffect(() => {
    pushSnapshot(false);
  }, [pushSnapshot]);

  const shellsRef = useRef(shells);
  shellsRef.current = shells;

  const runCommand = useCallback(
    async (command: WatchCommand): Promise<void> => {
      const bridge = resolveWatchBridge();
      if (bridge === null) {
        return;
      }
      if (command.type === "requestSnapshot") {
        pushSnapshot(true);
        return;
      }

      const environmentId = EnvironmentId.make(command.environmentId);
      const threadId = ThreadId.make(command.threadId);
      const shell = shellsRef.current.find(
        (candidate) => candidate.environmentId === environmentId && candidate.id === threadId,
      );
      const finish = (ok: boolean, error: string | null) => {
        bridge.sendMessage(
          serializeWatchCommandResult({
            type: "commandResult",
            commandId: command.commandId,
            ok,
            error,
          }),
        );
      };
      if (shell === undefined) {
        finish(false, "That task is no longer available.");
        return;
      }

      const result = await (() => {
        switch (command.type) {
          case "respondToApproval":
            return respondToApproval({
              environmentId,
              input: {
                threadId,
                requestId: ApprovalRequestId.make(command.requestId),
                decision: command.decision,
              },
            });
          case "respondToUserInput":
            return respondToUserInput({
              environmentId,
              input: {
                threadId,
                requestId: ApprovalRequestId.make(command.requestId),
                answers: command.answers,
              },
            });
          case "sendMessage":
            return startTurn({ environmentId, input: buildReplyInput(shell, command.text) });
          case "interruptTurn":
            return interruptTurn({
              environmentId,
              input: {
                commandId: CommandId.make(makeQueuedMessageMetadata().commandId),
                threadId,
                createdAt: new Date().toISOString(),
              },
            });
        }
      })();

      if (AsyncResult.isFailure(result)) {
        const error = Cause.squash(result.cause);
        finish(false, error instanceof Error ? error.message : "The request failed.");
        return;
      }
      finish(true, null);
    },
    [interruptTurn, pushSnapshot, respondToApproval, respondToUserInput, startTurn],
  );

  useEffect(() => {
    const bridge = resolveWatchBridge();
    if (bridge === null) {
      return;
    }
    const commandSubscription = bridge.addListener("onWatchCommand", ({ json }) => {
      const command = parseWatchCommand(json);
      if (command === null) {
        console.warn("[watch-bridge] ignored malformed command");
        return;
      }
      void runCommand(command);
    });
    const reachabilitySubscription = bridge.addListener("onReachabilityChange", ({ reachable }) => {
      if (reachable) {
        pushSnapshot(true);
      }
    });
    return () => {
      commandSubscription.remove();
      reachabilitySubscription.remove();
    };
  }, [pushSnapshot, runCommand]);

  return (
    <>
      {requestShells.map((shell) => (
        <PendingRequestsProbe
          key={scopedThreadKey(shell.environmentId, shell.id)}
          shell={shell}
          onChange={onRequestsChange}
        />
      ))}
    </>
  );
}

function buildReplyInput(shell: EnvironmentThreadShell, text: string) {
  const metadata = makeQueuedMessageMetadata();
  return {
    commandId: CommandId.make(metadata.commandId),
    threadId: shell.id,
    message: {
      messageId: MessageId.make(metadata.messageId),
      role: "user" as const,
      text: text.trim(),
      attachments: [],
    },
    modelSelection: shell.modelSelection,
    runtimeMode: shell.runtimeMode,
    interactionMode: shell.interactionMode,
    createdAt: metadata.createdAt,
  };
}

/**
 * Subscribing to a thread's detail state loads its activities; that is the
 * only place request ids, approval options and questions live, and only
 * threads that report a pending request pay for it.
 */
function PendingRequestsProbe(props: {
  readonly shell: EnvironmentThreadShell;
  readonly onChange: (key: string, requests: PendingThreadRequests | null) => void;
}) {
  const { shell, onChange } = props;
  const key = scopedThreadKey(shell.environmentId, shell.id);
  const state = useEnvironmentThread(shell.environmentId, shell.id);
  const activities = Option.getOrNull(state.data)?.activities ?? null;
  const requests = useMemo((): PendingThreadRequests | null => {
    if (activities === null) {
      return null;
    }
    const sorted = sortThreadActivities(activities);
    return {
      approvals: derivePendingApprovals(sorted),
      userInputs: derivePendingUserInputs(sorted),
    };
  }, [activities]);

  useEffect(() => {
    onChange(key, requests);
  }, [key, onChange, requests]);

  useEffect(() => () => onChange(key, null), [key, onChange]);

  return null;
}
