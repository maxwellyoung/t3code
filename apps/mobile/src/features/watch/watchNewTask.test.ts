import { describe, expect, it } from "vite-plus/test";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";

import { buildWatchNewTaskMessage } from "./watchNewTask";

const metadata = {
  commandId: "command-1",
  messageId: "message-1",
  threadId: "thread-new",
  createdAt: "2026-09-17T00:00:00.000Z",
};

const project = {
  environmentId: "env-1",
  id: "project-1",
  title: "Silk",
  workspaceRoot: "/work/silk",
  defaultModelSelection: null,
} as EnvironmentProject;

function shell(
  id: string,
  overrides: Partial<EnvironmentThreadShell> = {},
): EnvironmentThreadShell {
  return {
    id,
    environmentId: "env-1",
    projectId: "project-1",
    modelSelection: { instanceId: "codex", model: "gpt-5-codex" },
    runtimeMode: "approval-required",
    interactionMode: "default",
    updatedAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  } as EnvironmentThreadShell;
}

const start = (input: Partial<Parameters<typeof buildWatchNewTaskMessage>[0]>) =>
  buildWatchNewTaskMessage({
    environmentId: "env-1",
    projectId: "project-1",
    text: "Fix the flaky login test",
    projects: [project],
    shells: [shell("a")],
    metadata,
    ...input,
  });

describe("buildWatchNewTaskMessage", () => {
  it("queues a local task with the settings of the project's most recent thread", () => {
    const message = start({
      text: "  Fix the flaky login test  ",
      shells: [
        shell("older", { updatedAt: "2026-09-01T00:00:00.000Z" }),
        shell("newer", {
          updatedAt: "2026-09-10T00:00:00.000Z",
          modelSelection: {
            instanceId: "claude",
            model: "opus",
          } as EnvironmentThreadShell["modelSelection"],
          runtimeMode: "full-access",
          interactionMode: "plan",
        }),
        shell("archived", {
          updatedAt: "2026-09-12T00:00:00.000Z",
          archivedAt: "2026-09-12T00:00:00.000Z",
          runtimeMode: "auto",
        }),
      ],
    });
    expect(message).toMatchObject({
      environmentId: "env-1",
      threadId: "thread-new",
      text: "Fix the flaky login test",
      attachments: [],
      modelSelection: { instanceId: "claude", model: "opus" },
      runtimeMode: "full-access",
      interactionMode: "plan",
      creation: {
        projectId: "project-1",
        projectTitle: "Silk",
        projectCwd: "/work/silk",
        workspaceMode: "local",
        branch: null,
        worktreePath: null,
      },
    });
  });

  it("prefers the project's default model over the last thread's", () => {
    const withDefault = {
      ...project,
      defaultModelSelection: { instanceId: "claude", model: "sonnet" },
    } as EnvironmentProject;
    expect(start({ projects: [withDefault] })?.modelSelection).toEqual({
      instanceId: "claude",
      model: "sonnet",
    });
  });

  it("starts nothing without text, a known project, or a live thread to inherit from", () => {
    expect(start({ text: "   " })).toBeNull();
    expect(start({ projectId: "project-missing" })).toBeNull();
    expect(
      start({ shells: [shell("gone", { archivedAt: "2026-09-02T00:00:00.000Z" })] }),
    ).toBeNull();
  });
});
