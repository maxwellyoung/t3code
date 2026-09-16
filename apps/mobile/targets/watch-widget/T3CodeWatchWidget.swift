import SwiftUI
import WidgetKit

struct AttentionEntry: TimelineEntry {
  let date: Date
  let summary: WatchComplicationSummary
}

/// A single entry that never expires on its own: the watch app reloads the
/// timeline whenever the counts change.
struct AttentionProvider: TimelineProvider {
  func placeholder(in context: Context) -> AttentionEntry {
    AttentionEntry(date: Date(), summary: .preview)
  }

  func getSnapshot(in context: Context, completion: @escaping (AttentionEntry) -> Void) {
    let summary = context.isPreview ? .preview : (WatchComplicationStore.load() ?? .empty)
    completion(AttentionEntry(date: Date(), summary: summary))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AttentionEntry>) -> Void) {
    let entry = AttentionEntry(date: Date(), summary: WatchComplicationStore.load() ?? .empty)
    completion(Timeline(entries: [entry], policy: .never))
  }
}

@main
struct T3CodeWatchWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "T3CodeAttention", provider: AttentionProvider()) { entry in
      AttentionView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("T3 Code")
    .description("Agents that need you and agents at work.")
    .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
  }
}

struct AttentionView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AttentionEntry

  private var summary: WatchComplicationSummary { entry.summary }
  private var isStale: Bool { summary.isStale(at: entry.date) }
  /// Attention first: the number worth acting on, otherwise the number running.
  private var primaryCount: Int {
    summary.needsYouCount > 0 ? summary.needsYouCount : summary.workingCount
  }
  private var symbol: String {
    summary.needsYouCount > 0 ? "exclamationmark.bubble.fill" : "sparkles"
  }

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Image(systemName: symbol).font(.caption2)
          Text(isStale ? "–" : "\(primaryCount)").font(.title3.bold())
        }
      }
      .widgetAccentable()
    case .accessoryCorner:
      Image(systemName: symbol)
        .font(.title3)
        .widgetLabel(isStale ? "T3 Code" : countsText)
        .widgetAccentable()
    case .accessoryInline:
      Text(isStale ? "T3 Code · open to refresh" : "T3 · \(countsText)")
    default:
      VStack(alignment: .leading, spacing: 1) {
        Text("T3 Code").font(.headline).widgetAccentable()
        if isStale {
          Text("Open to refresh").font(.caption)
        } else {
          Text(countsText).font(.caption)
          if let headline = summary.headline {
            Text(headline).font(.caption2).lineLimit(1).foregroundStyle(.secondary)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var countsText: String {
    switch (summary.needsYouCount, summary.workingCount) {
    case (0, 0): return "All quiet"
    case (let needs, 0): return "\(needs) need\(needs == 1 ? "s" : "") you"
    case (0, let working): return "\(working) working"
    case (let needs, let working): return "\(needs) need\(needs == 1 ? "s" : "") you · \(working) working"
    }
  }
}
