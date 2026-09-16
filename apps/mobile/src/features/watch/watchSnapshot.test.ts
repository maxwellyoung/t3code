import { ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";

import type { PendingApproval, PendingUserInput } from "../../lib/threadActivity";
import {
  buildWatchSnapshotBody,
  serializeWatchSnapshot,
  toWatchApproval,
  WATCH_QUICK_REPLIES,
  WATCH_SNAPSHOT_MAX_THREADS,
} from "./watchSnapshot";

function shell(
  id: string,
  overrides: Partial<EnvironmentThreadShell> = {},
): EnvironmentThreadShell {
  return {
    id,
    environmentId: "env-1",
    projectId: "project-1",
    title: `Thread ${id}`,
    modelSelection: { provider: "codex", model: "gpt-5-codex" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: null,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    session: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...overrides,
  } as EnvironmentThreadShell;
}

const project: EnvironmentProject = {
  environmentId: "env-1",
  id: "project-1",
  title: "Silk",
} as EnvironmentProject;

const running = (id: string, updatedAt: string) =>
  shell(id, {
    updatedAt,
    session: { status: "running", providerName: "Codex" } as EnvironmentThreadShell["session"],
  });

describe("buildWatchSnapshotBody", () => {
  it("puts threads that need the user first, then most recent activity", () => {
    const body = buildWatchSnapshotBody({
      shells: [
        running("older-running", "2026-08-26T01:00:00.000Z"),
        shell("done", {
          latestTurn: {
            state: "completed",
            completedAt: "x",
          } as EnvironmentThreadShell["latestTurn"],
        }),
        running("newer-running", "2026-08-26T02:00:00.000Z"),
        shell("approval", { hasPendingApprovals: true }),
        shell("question", { hasPendingUserInput: true }),
      ],
      projects: [project],
      requestsByThreadKey: {},
    });

    expect(body.threads.map((thread) => thread.threadId)).toEqual([
      "approval",
      "question",
      "newer-running",
      "older-running",
      "done",
    ]);
    expect(body.threads[0]?.projectTitle).toBe("Silk");
    expect(body.threads[0]?.phase).toBe("waiting_for_approval");
    expect(body.quickReplies).toEqual(WATCH_QUICK_REPLIES);
  });

  it("drops archived and idle threads and caps the list", () => {
    const shells = Array.from({ length: WATCH_SNAPSHOT_MAX_THREADS + 5 }, (_, index) =>
      running(`t-${index}`, `2026-08-26T00:00:${String(index).padStart(2, "0")}.000Z`),
    );
    const body = buildWatchSnapshotBody({
      shells: [
        ...shells,
        shell("archived", { archivedAt: "2026-08-26T00:00:00.000Z", hasPendingApprovals: true }),
        shell("idle"),
      ],
      projects: [project],
      requestsByThreadKey: {},
    });
    const ids = body.threads.map((thread) => thread.threadId);
    expect(ids).toHaveLength(WATCH_SNAPSHOT_MAX_THREADS);
    expect(ids).not.toContain("archived");
    expect(ids).not.toContain("idle");
  });

  it("attaches approvals and questions only from the thread's own pending requests", () => {
    const approval: PendingApproval = {
      requestId: "req-1" as PendingApproval["requestId"],
      requestKind: "command",
      createdAt: "2026-08-26T00:00:00.000Z",
      detail: "rm -rf node_modules",
      options: [
        { decision: "accept", label: "Run" },
        { decision: "decline", label: "Skip" },
      ],
    };
    const userInput: PendingUserInput = {
      requestId: "req-2" as PendingUserInput["requestId"],
      createdAt: "2026-08-26T00:00:00.000Z",
      dismissible: false,
      questions: [
        {
          id: "q1",
          header: "Scope",
          question: "Which surface first?",
          multiSelect: false,
          options: [
            { label: "Web", description: "The app.t3.codes surface" },
            { label: "Mobile", description: "React Native" },
          ],
        },
      ],
    };
    const body = buildWatchSnapshotBody({
      shells: [
        shell("approval", { hasPendingApprovals: true }),
        shell("question", { hasPendingUserInput: true }),
      ],
      projects: [project],
      requestsByThreadKey: {
        "env-1:approval": { approvals: [approval], userInputs: [] },
        "env-1:question": { approvals: [], userInputs: [userInput] },
      },
    });

    const [approvalThread, questionThread] = body.threads;
    expect(approvalThread?.approvals).toEqual([
      {
        requestId: "req-1",
        requestKind: "command",
        detail: "rm -rf node_modules",
        createdAt: "2026-08-26T00:00:00.000Z",
        options: [
          { decision: "accept", label: "Run" },
          { decision: "decline", label: "Skip" },
        ],
      },
    ]);
    expect(approvalThread?.userInputs).toEqual([]);
    expect(questionThread?.userInputs[0]?.questions[0]?.options.map((o) => o.label)).toEqual([
      "Web",
      "Mobile",
    ]);
  });

  it("falls back to Allow/Deny when the provider gives no options", () => {
    const watchApproval = toWatchApproval({
      requestId: "req" as PendingApproval["requestId"],
      requestKind: "file-change",
      createdAt: "2026-08-26T00:00:00.000Z",
    });
    expect(watchApproval.options.map((option) => option.decision)).toEqual(["accept", "decline"]);
    expect(watchApproval.detail).toBeNull();
  });

  it("serializes with a generation timestamp", () => {
    const json = serializeWatchSnapshot(
      { version: 1, quickReplies: [], threads: [], projects: [] },
      "2026-08-26T03:00:00.000Z",
    );
    expect(JSON.parse(json)).toEqual({
      version: 1,
      quickReplies: [],
      threads: [],
      projects: [],
      generatedAt: "2026-08-26T03:00:00.000Z",
    });
  });

  it("offers projects with a live thread to start tasks in, most recently active first", () => {
    const t3code = {
      environmentId: "env-1",
      id: "project-2",
      title: "T3 Code",
    } as EnvironmentProject;
    const archivedOnly = {
      environmentId: "env-1",
      id: "project-3",
      title: "Archived only",
    } as EnvironmentProject;
    const body = buildWatchSnapshotBody({
      shells: [
        shell("a", { updatedAt: "2026-08-26T01:00:00.000Z" }),
        shell("b", {
          projectId: ProjectId.make("project-2"),
          updatedAt: "2026-08-26T02:00:00.000Z",
        }),
        shell("c", {
          projectId: ProjectId.make("project-3"),
          archivedAt: "2026-08-26T03:00:00.000Z",
        }),
      ],
      projects: [project, t3code, archivedOnly],
      requestsByThreadKey: {},
    });
    expect(body.projects).toEqual([
      { environmentId: "env-1", projectId: "project-2", title: "T3 Code" },
      { environmentId: "env-1", projectId: "project-1", title: "Silk" },
    ]);
  });
});
