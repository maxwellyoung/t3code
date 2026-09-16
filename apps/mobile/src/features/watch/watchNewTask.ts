import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { CommandId, MessageId, ThreadId } from "@t3tools/contracts";

import type { TurnCommandMetadata } from "../../lib/commandMetadata";
import type { QueuedThreadMessage } from "../../state/thread-outbox-model";

/**
 * Builds the outbox entry for a task started from the watch, so it is
 * delivered, retried and shown exactly like one started from the New Task
 * screen. Returns null when the project is unknown, has no thread to inherit
 * settings from, or the text is empty.
 *
 * The watch has no composer, so settings come from the project: its default
 * model when set, otherwise the model of its most recently updated thread,
 * whose runtime and interaction modes it also takes. It always runs in the
 * current checkout, because a worktree needs a base branch the watch cannot
 * choose.
 */
export function buildWatchNewTaskMessage(input: {
  readonly environmentId: string;
  readonly projectId: string;
  readonly text: string;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly shells: ReadonlyArray<EnvironmentThreadShell>;
  readonly metadata: TurnCommandMetadata;
}): QueuedThreadMessage | null {
  const text = input.text.trim();
  if (text.length === 0) {
    return null;
  }
  const project = input.projects.find(
    (candidate) =>
      candidate.environmentId === input.environmentId && candidate.id === input.projectId,
  );
  if (project === undefined) {
    return null;
  }
  let latest: EnvironmentThreadShell | undefined;
  for (const shell of input.shells) {
    if (
      shell.environmentId !== project.environmentId ||
      shell.projectId !== project.id ||
      shell.archivedAt !== null
    ) {
      continue;
    }
    if (latest === undefined || shell.updatedAt > latest.updatedAt) {
      latest = shell;
    }
  }
  if (latest === undefined) {
    return null;
  }
  return {
    environmentId: project.environmentId,
    threadId: ThreadId.make(input.metadata.threadId),
    messageId: MessageId.make(input.metadata.messageId),
    commandId: CommandId.make(input.metadata.commandId),
    text,
    attachments: [],
    modelSelection: project.defaultModelSelection ?? latest.modelSelection,
    runtimeMode: latest.runtimeMode,
    interactionMode: latest.interactionMode,
    creation: {
      projectId: project.id,
      projectTitle: project.title,
      projectCwd: project.workspaceRoot,
      workspaceMode: "local",
      branch: null,
      worktreePath: null,
    },
    createdAt: input.metadata.createdAt,
  };
}
