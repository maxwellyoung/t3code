import SwiftUI

// Wire format shared with apps/mobile/src/features/watch/watchSnapshot.ts and
// watchCommands.ts. Both sides validate; bump `WatchSnapshot.supportedVersion`
// with the TS constant when a field changes shape.

struct WatchSnapshot: Codable {
  static let supportedVersion = 1

  let version: Int
  let generatedAt: String
  let quickReplies: [String]
  let threads: [WatchThread]
  /// Absent from snapshots sent by phone builds that predate starting tasks.
  let projects: [WatchProject]?

  var generatedDate: Date? { ISO8601.date(from: generatedAt) }
}

struct WatchProject: Codable, Identifiable, Hashable {
  let environmentId: String
  let projectId: String
  let title: String

  var id: String { "\(environmentId):\(projectId)" }
}

struct WatchThread: Codable, Identifiable, Hashable {
  let environmentId: String
  let threadId: String
  let projectTitle: String
  let threadTitle: String
  let modelTitle: String
  let phase: String
  let headline: String
  let detail: String?
  let updatedAt: String
  let deepLink: String
  let approvals: [WatchApproval]
  let userInputs: [WatchUserInput]

  var id: String { "\(environmentId):\(threadId)" }
  var resolvedPhase: WatchPhase { WatchPhase(rawValue: phase) ?? .stale }
}

struct WatchApproval: Codable, Identifiable, Hashable {
  let requestId: String
  let requestKind: String
  let detail: String?
  let createdAt: String
  let options: [WatchApprovalOption]

  var id: String { requestId }
}

struct WatchApprovalOption: Codable, Hashable {
  let decision: String
  let label: String

  var isAffirmative: Bool { decision.hasPrefix("accept") }
}

struct WatchUserInput: Codable, Identifiable, Hashable {
  let requestId: String
  let createdAt: String
  let questions: [WatchQuestion]

  var id: String { requestId }
}

struct WatchQuestion: Codable, Identifiable, Hashable {
  let id: String
  let header: String
  let question: String
  let multiSelect: Bool
  let options: [WatchQuestionOption]
}

struct WatchQuestionOption: Codable, Hashable, Identifiable {
  let label: String
  let description: String?

  var id: String { label }
}

struct WatchCommandResult: Codable {
  let type: String
  let commandId: String
  let ok: Bool
  let error: String?
}

enum WatchPhase: String {
  case starting
  case running
  case waitingForApproval = "waiting_for_approval"
  case waitingForInput = "waiting_for_input"
  case completed
  case failed
  case stale

  var needsUser: Bool {
    self == .waitingForApproval || self == .waitingForInput
  }

  var isActive: Bool {
    self == .starting || self == .running
  }

  // Mirrors the Live Activity tints: amber approval, indigo input, sky
  // working, emerald done, red failed.
  var tint: Color {
    switch self {
    case .waitingForApproval: return Color(red: 0.96, green: 0.62, blue: 0.04)
    case .waitingForInput: return Color(red: 0.51, green: 0.55, blue: 0.97)
    case .starting, .running: return Color(red: 0.22, green: 0.74, blue: 0.97)
    case .completed: return Color(red: 0.20, green: 0.83, blue: 0.60)
    case .failed: return Color(red: 0.97, green: 0.44, blue: 0.44)
    case .stale: return .secondary
    }
  }
}

enum ISO8601 {
  private static let fractional: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
  private static let plain = ISO8601DateFormatter()

  static func date(from string: String) -> Date? {
    fractional.date(from: string) ?? plain.date(from: string)
  }
}
