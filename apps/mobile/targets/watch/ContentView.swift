import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var store: WatchStore

  private var needsYou: [WatchThread] { store.threads.filter { $0.resolvedPhase.needsUser } }
  private var working: [WatchThread] { store.threads.filter { $0.resolvedPhase.isActive } }
  private var finished: [WatchThread] {
    store.threads.filter { !$0.resolvedPhase.needsUser && !$0.resolvedPhase.isActive }
  }

  var body: some View {
    NavigationStack {
      Group {
        if store.snapshot == nil {
          emptyState
        } else if store.threads.isEmpty {
          quietState
        } else {
          threadList
        }
      }
      .navigationTitle("T3 Code")
      // Registered on the stack, not on each row: rows live in a lazy List,
      // and a destination declared inside one is never seen by the stack, so
      // tapping a thread silently did nothing.
      .navigationDestination(for: String.self) { threadId in
        ThreadDetailView(threadId: threadId)
      }
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            store.requestSnapshot()
          } label: {
            Image(systemName: "arrow.clockwise")
          }
          .disabled(!store.isReachable)
        }
      }
    }
  }

  private var threadList: some View {
    List {
      if !needsYou.isEmpty {
        Section("Needs you") {
          ForEach(needsYou) { thread in
            ThreadRow(thread: thread)
          }
        }
      }
      if !working.isEmpty {
        Section("Working") {
          ForEach(working) { thread in
            ThreadRow(thread: thread)
          }
        }
      }
      if !finished.isEmpty {
        Section("Done") {
          ForEach(finished) { thread in
            ThreadRow(thread: thread)
          }
        }
      }
      Section {
        FreshnessFooter()
      }
      .listRowBackground(Color.clear)
    }
  }

  private var emptyState: some View {
    VStack(spacing: 8) {
      Image(systemName: "iphone.and.arrow.forward")
        .font(.title2)
        .foregroundStyle(.secondary)
      Text("Open T3 Code on your iPhone to sync.")
        .font(.footnote)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    }
    .padding()
  }

  private var quietState: some View {
    VStack(spacing: 8) {
      Image(systemName: "checkmark.circle")
        .font(.title2)
        .foregroundStyle(.secondary)
      Text("No agents running.")
        .font(.footnote)
        .foregroundStyle(.secondary)
      FreshnessFooter()
    }
    .padding()
  }
}

struct ThreadRow: View {
  let thread: WatchThread

  var body: some View {
    NavigationLink(value: thread.id) {
      HStack(alignment: .top, spacing: 8) {
        Circle()
          .fill(thread.resolvedPhase.tint)
          .frame(width: 8, height: 8)
          .padding(.top, 6)
        VStack(alignment: .leading, spacing: 2) {
          Text(thread.threadTitle)
            .font(.headline)
            .lineLimit(2)
          Text("\(thread.projectTitle) · \(thread.headline)")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(2)
        }
      }
    }
  }
}

struct FreshnessFooter: View {
  @EnvironmentObject private var store: WatchStore

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: store.isReachable ? "iphone.radiowaves.left.and.right" : "iphone.slash")
      if let date = store.snapshot?.generatedDate {
        Text("Updated \(date, style: .relative) ago")
      } else {
        Text("Waiting for iPhone")
      }
    }
    .font(.caption2)
    .foregroundStyle(.tertiary)
    .frame(maxWidth: .infinity)
  }
}
