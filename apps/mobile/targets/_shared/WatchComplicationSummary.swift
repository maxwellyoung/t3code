import Foundation

/// What the watch face complication shows. The watch app writes it to the
/// shared app group whenever a snapshot changes the counts; the widget only
/// reads it, because widgets cannot talk to the phone themselves.
struct WatchComplicationSummary: Codable, Equatable {
  let needsYouCount: Int
  let workingCount: Int
  /// The thread most worth a glance: the first that needs the user, otherwise
  /// the first still running.
  let headline: String?
  let updatedAt: Date

  static let empty = WatchComplicationSummary(
    needsYouCount: 0,
    workingCount: 0,
    headline: nil,
    updatedAt: .distantPast
  )

  static let preview = WatchComplicationSummary(
    needsYouCount: 1,
    workingCount: 2,
    headline: "Fix the flaky login test",
    updatedAt: Date()
  )

  /// Counts older than this came from a snapshot the phone has not refreshed,
  /// so the complication says so instead of presenting them as current.
  static let staleAfter: TimeInterval = 60 * 60

  func isStale(at date: Date) -> Bool {
    date.timeIntervalSince(updatedAt) > Self.staleAfter
  }

  /// Equal apart from when it was computed: the reload trigger ignores time so
  /// an unchanged snapshot does not spend WidgetKit's reload budget.
  func hasSameContent(as other: WatchComplicationSummary) -> Bool {
    needsYouCount == other.needsYouCount
      && workingCount == other.workingCount
      && headline == other.headline
  }
}

enum WatchComplicationStore {
  private static let defaultsKey = "t3code.watch.complication"

  /// The watch app and its widget share `group.<iPhone bundle id>`; both bundle
  /// ids start with the iPhone one followed by `.watchkitapp`.
  static var suiteName: String? {
    guard let bundleId = Bundle.main.bundleIdentifier,
      let range = bundleId.range(of: ".watchkitapp")
    else {
      return nil
    }
    return "group.\(bundleId[..<range.lowerBound])"
  }

  private static var defaults: UserDefaults? {
    suiteName.flatMap { UserDefaults(suiteName: $0) }
  }

  static func load() -> WatchComplicationSummary? {
    guard let data = defaults?.data(forKey: defaultsKey) else { return nil }
    return try? JSONDecoder().decode(WatchComplicationSummary.self, from: data)
  }

  static func save(_ summary: WatchComplicationSummary) {
    guard let data = try? JSONEncoder().encode(summary) else { return }
    defaults?.set(data, forKey: defaultsKey)
  }
}
