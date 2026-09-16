import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { projectThreadAwareness, type AgentAwarenessPhase } from "@t3tools/shared/agentAwareness";

import { scopedThreadKey } from "../../lib/scopedEntities";
import type { PendingApproval, PendingUserInput } from "../../lib/threadActivity";

/**
 * Wire format shared with `targets/watch/WatchModels.swift`. Bump `version`
 * together with the Swift decoder when a field changes shape.
 */
export const WATCH_SNAPSHOT_VERSION = 1;
export const WATCH_SNAPSHOT_MAX_THREADS = 20;
export const WATCH_SNAPSHOT_MAX_PROJECTS = 8;
const WATCH_DETAIL_MAX_CHARS = 240;

export interface WatchApprovalOption {
  readonly decision: string;
  readonly label: string;
}

export interface WatchApproval {
  readonly requestId: string;
  readonly requestKind: string;
  readonly detail: string | null;
  readonly createdAt: string;
  readonly options: ReadonlyArray<WatchApprovalOption>;
}

export interface WatchQuestionOption {
  readonly label: string;
  readonly description: string | null;
}

export interface WatchQuestion {
  readonly id: string;
  readonly header: string;
  readonly question: string;
  readonly multiSelect: boolean;
  readonly options: ReadonlyArray<WatchQuestionOption>;
}

export interface WatchUserInput {
  readonly requestId: string;
  readonly createdAt: string;
  readonly questions: ReadonlyArray<WatchQuestion>;
}

export interface WatchThread {
  readonly environmentId: string;
  readonly threadId: string;
  readonly projectTitle: string;
  readonly threadTitle: string;
  readonly modelTitle: string;
  readonly phase: AgentAwarenessPhase;
  readonly headline: string;
  readonly detail: string | null;
  readonly updatedAt: string;
  readonly deepLink: string;
  readonly approvals: ReadonlyArray<WatchApproval>;
  readonly userInputs: ReadonlyArray<WatchUserInput>;
}

export interface WatchProject {
  readonly environmentId: string;
  readonly projectId: string;
  readonly title: string;
}

export interface WatchSnapshotBody {
  readonly version: typeof WATCH_SNAPSHOT_VERSION;
  /** One-tap replies the watch offers on every thread; first is primary. */
  readonly quickReplies: ReadonlyArray<string>;
  readonly threads: ReadonlyArray<WatchThread>;
  /**
   * Projects a task can be started in from the watch, most recently active
   * first. Only projects with a thread qualify: a new task inherits its settings.
   */
  readonly projects: ReadonlyArray<WatchProject>;
}

// Short enough to fit a watch button, generic enough to move any agent along.
export const WATCH_QUICK_REPLIES: ReadonlyArray<string> = [
  "Full steam ahead",
  "Yes",
  "No",
  "Looks good, continue",
  "Ship it",
];

export interface WatchSnapshot extends WatchSnapshotBody {
  readonly generatedAt: string;
}

// Attention-first, matching the Live Activity ordering: things that need the
// user's hand come before things that are merely in flight or finished.
const PHASE_RANK: Record<AgentAwarenessPhase, number> = {
  waiting_for_approval: 0,
  waiting_for_input: 1,
  failed: 2,
  running: 3,
  starting: 4,
  stale: 5,
  completed: 6,
};

const DEFAULT_APPROVAL_OPTIONS: ReadonlyArray<WatchApprovalOption> = [
  { decision: "accept", label: "Allow" },
  { decision: "decline", label: "Deny" },
];

function truncate(text: string | undefined): string | null {
  if (text === undefined) {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.length > WATCH_DETAIL_MAX_CHARS
    ? `${trimmed.slice(0, WATCH_DETAIL_MAX_CHARS - 1)}…`
    : trimmed;
}

export function toWatchApproval(approval: PendingApproval): WatchApproval {
  const options =
    approval.options && approval.options.length > 0
      ? approval.options.map((option) => ({ decision: option.decision, label: option.label }))
      : DEFAULT_APPROVAL_OPTIONS;
  return {
    requestId: approval.requestId,
    requestKind: approval.requestKind,
    detail: truncate(approval.detail),
    createdAt: approval.createdAt,
    options,
  };
}

export function toWatchUserInput(userInput: PendingUserInput): WatchUserInput {
  return {
    requestId: userInput.requestId,
    createdAt: userInput.createdAt,
    questions: userInput.questions.map((question) => ({
      id: question.id,
      header: question.header,
      question: question.question,
      multiSelect: question.multiSelect === true,
      options: question.options.map((option) => ({
        label: option.label,
        description: truncate(option.description),
      })),
    })),
  };
}

export interface PendingThreadRequests {
  readonly approvals: ReadonlyArray<PendingApproval>;
  readonly userInputs: ReadonlyArray<PendingUserInput>;
}

export interface BuildWatchSnapshotInput {
  readonly shells: ReadonlyArray<EnvironmentThreadShell>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  /** Pending requests keyed by `scopedThreadKey`, for threads that report them. */
  readonly requestsByThreadKey: Readonly<Record<string, PendingThreadRequests>>;
}

export function buildWatchSnapshotBody(input: BuildWatchSnapshotInput): WatchSnapshotBody {
  const projectTitles = new Map<string, string>();
  for (const project of input.projects) {
    projectTitles.set(`${project.environmentId}:${project.id}`, project.title);
  }

  const threads: WatchThread[] = [];
  const latestUpdateByProject = new Map<string, string>();
  for (const shell of input.shells) {
    if (shell.archivedAt !== null) {
      continue;
    }
    const projectKey = `${shell.environmentId}:${shell.projectId}`;
    const latestUpdate = latestUpdateByProject.get(projectKey);
    if (latestUpdate === undefined || shell.updatedAt > latestUpdate) {
      latestUpdateByProject.set(projectKey, shell.updatedAt);
    }
    const projectTitle =
      projectTitles.get(`${shell.environmentId}:${shell.projectId}`) ?? "Project";
    const awareness = projectThreadAwareness({
      environmentId: shell.environmentId,
      project: { title: projectTitle },
      thread: shell,
    });
    if (awareness === null) {
      continue;
    }
    const requests = input.requestsByThreadKey[scopedThreadKey(shell.environmentId, shell.id)];
    const approvals =
      shell.hasPendingApprovals && requests ? requests.approvals.map(toWatchApproval) : [];
    const userInputs =
      shell.hasPendingUserInput && requests ? requests.userInputs.map(toWatchUserInput) : [];
    threads.push({
      environmentId: awareness.environmentId,
      threadId: awareness.threadId,
      projectTitle: awareness.projectTitle,
      threadTitle: awareness.threadTitle,
      modelTitle: awareness.modelTitle,
      phase: awareness.phase,
      headline: awareness.headline,
      detail: truncate(awareness.detail),
      updatedAt: awareness.updatedAt,
      deepLink: awareness.deepLink,
      approvals,
      userInputs,
    });
  }

  threads.sort((left, right) => {
    const rank = PHASE_RANK[left.phase] - PHASE_RANK[right.phase];
    if (rank !== 0) {
      return rank;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const projects = input.projects
    .flatMap((project) => {
      const latestUpdate = latestUpdateByProject.get(`${project.environmentId}:${project.id}`);
      return latestUpdate === undefined ? [] : [{ project, latestUpdate }];
    })
    .sort((left, right) => right.latestUpdate.localeCompare(left.latestUpdate))
    .slice(0, WATCH_SNAPSHOT_MAX_PROJECTS)
    .map(({ project }) => ({
      environmentId: project.environmentId,
      projectId: project.id,
      title: project.title,
    }));

  return {
    version: WATCH_SNAPSHOT_VERSION,
    quickReplies: WATCH_QUICK_REPLIES,
    threads: threads.slice(0, WATCH_SNAPSHOT_MAX_THREADS),
    projects,
  };
}

export function serializeWatchSnapshot(body: WatchSnapshotBody, generatedAt: string): string {
  const snapshot: WatchSnapshot = { ...body, generatedAt };
  return JSON.stringify(snapshot);
}
