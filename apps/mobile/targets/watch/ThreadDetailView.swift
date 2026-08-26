import SwiftUI

/// One thread: what it needs from you first, then the fastest ways to keep it
/// moving (quick replies), then dictation and stop as fallbacks.
///
/// Split into small views on purpose: one large `List` body exceeds the Swift
/// type-checker's budget on the watchOS target.
struct ThreadDetailView: View {
  @EnvironmentObject private var store: WatchStore
  let threadId: String

  var body: some View {
    if let thread = store.thread(id: threadId) {
      ThreadDetailList(thread: thread)
    } else {
      Text("This task is no longer listed.")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding()
    }
  }
}

private struct ThreadDetailList: View {
  @EnvironmentObject private var store: WatchStore
  let thread: WatchThread

  var body: some View {
    let inFlight = store.inFlightThreadIds.contains(thread.id)
    List {
      ThreadHeaderSection(thread: thread)
      if let feedback = store.feedbackByThreadId[thread.id] {
        FeedbackSection(feedback: feedback)
      }
      ForEach(thread.approvals) { approval in
        ApprovalSection(thread: thread, approval: approval)
      }
      ForEach(thread.userInputs) { input in
        UserInputSections(thread: thread, input: input)
      }
      ReplySection(thread: thread)
      if thread.resolvedPhase.isActive {
        StopSection(thread: thread)
      }
    }
    .navigationTitle(thread.projectTitle)
    .disabled(inFlight)
    .overlay(alignment: .top) {
      if inFlight {
        ProgressView().padding(.top, 4)
      }
    }
  }
}

private struct ThreadHeaderSection: View {
  let thread: WatchThread

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        Text(thread.threadTitle)
          .font(.headline)
        Text("\(thread.projectTitle) · \(thread.modelTitle)")
          .font(.caption2)
          .foregroundStyle(.secondary)
        HStack(spacing: 6) {
          Circle()
            .fill(thread.resolvedPhase.tint)
            .frame(width: 8, height: 8)
          Text(thread.headline)
            .font(.caption)
        }
        if let detail = thread.detail {
          Text(detail)
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
    }
    .listRowBackground(Color.clear)
  }
}

private struct FeedbackSection: View {
  let feedback: WatchFeedback

  var body: some View {
    Section {
      Label(feedback.text, systemImage: feedback.ok ? "checkmark.circle.fill" : "xmark.octagon.fill")
        .font(.caption)
        .foregroundStyle(feedback.ok ? Color.green : Color.red)
    }
    .listRowBackground(Color.clear)
  }
}

private struct ApprovalSection: View {
  @EnvironmentObject private var store: WatchStore
  let thread: WatchThread
  let approval: WatchApproval

  private var title: String {
    switch approval.requestKind {
    case "command": return "Run command?"
    case "file-read": return "Read file?"
    case "file-change": return "Change file?"
    default: return "Approve?"
    }
  }

  var body: some View {
    Section(title) {
      if let detail = approval.detail {
        Text(detail)
          .font(.system(.caption2, design: .monospaced))
          .lineLimit(6)
      }
      ForEach(approval.options, id: \.decision) { option in
        ApprovalButton(option: option) {
          store.respond(to: approval, decision: option.decision, in: thread)
        }
      }
    }
  }
}

private struct ApprovalButton: View {
  let option: WatchApprovalOption
  let action: () -> Void

  var body: some View {
    Button(option.label, action: action)
      .tint(option.isAffirmative ? Color.green : Color.red)
      .buttonStyle(.borderedProminent)
  }
}

/// One section per question, plus a send button when a single tap cannot
/// finish the request (multi-select or several questions).
private struct UserInputSections: View {
  @EnvironmentObject private var store: WatchStore
  let thread: WatchThread
  let input: WatchUserInput

  @State private var selections: [String: Set<String>] = [:]

  private var needsSendButton: Bool {
    input.questions.count > 1 || input.questions.contains { $0.multiSelect }
  }

  private var allAnswered: Bool {
    input.questions.allSatisfy { !(selections[$0.id] ?? []).isEmpty }
  }

  var body: some View {
    ForEach(input.questions) { question in
      QuestionSection(
        question: question,
        selected: selections[question.id] ?? [],
        onChoose: { label in choose(label, for: question) }
      )
    }
    if needsSendButton {
      Section {
        Button("Send answers") { send() }
          .buttonStyle(.borderedProminent)
          .disabled(!allAnswered)
      }
    }
  }

  private func choose(_ label: String, for question: WatchQuestion) {
    var chosen = selections[question.id] ?? []
    if question.multiSelect {
      if chosen.contains(label) {
        chosen.remove(label)
      } else {
        chosen.insert(label)
      }
    } else {
      chosen = [label]
    }
    selections[question.id] = chosen
    // The common case — one single-choice question — sends on tap.
    if !needsSendButton {
      send()
    }
  }

  private func send() {
    var answers: [String: Any] = [:]
    for question in input.questions {
      let chosen = selections[question.id] ?? []
      if question.multiSelect {
        answers[question.id] = question.options.map(\.label).filter { chosen.contains($0) }
      } else if let single = chosen.first {
        answers[question.id] = single
      }
    }
    store.answer(input, answers: answers, in: thread)
  }
}

private struct QuestionSection: View {
  let question: WatchQuestion
  let selected: Set<String>
  let onChoose: (String) -> Void

  var body: some View {
    Section(question.header) {
      Text(question.question)
        .font(.caption)
      ForEach(question.options) { option in
        QuestionOptionRow(option: option, isSelected: selected.contains(option.label)) {
          onChoose(option.label)
        }
      }
    }
  }
}

private struct QuestionOptionRow: View {
  let option: WatchQuestionOption
  let isSelected: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text(option.label)
            .font(.body)
          if let description = option.description {
            Text(description)
              .font(.caption2)
              .foregroundStyle(.secondary)
              .lineLimit(2)
          }
        }
        Spacer(minLength: 0)
        if isSelected {
          Image(systemName: "checkmark")
            .foregroundStyle(.tint)
        }
      }
    }
  }
}

private struct ReplySection: View {
  @EnvironmentObject private var store: WatchStore
  let thread: WatchThread

  @State private var draft = ""

  var body: some View {
    Section("Reply") {
      ForEach(Array(store.quickReplies.enumerated()), id: \.offset) { index, reply in
        QuickReplyButton(title: reply, prominent: index == 0) {
          store.reply(reply, in: thread)
        }
      }
      TextField("Dictate…", text: $draft)
        .onSubmit {
          store.reply(draft, in: thread)
          draft = ""
        }
    }
  }
}

private struct QuickReplyButton: View {
  let title: String
  let prominent: Bool
  let action: () -> Void

  var body: some View {
    if prominent {
      Button(title, action: action)
        .buttonStyle(.borderedProminent)
    } else {
      Button(title, action: action)
        .buttonStyle(.bordered)
    }
  }
}

private struct StopSection: View {
  @EnvironmentObject private var store: WatchStore
  let thread: WatchThread

  var body: some View {
    Section {
      Button("Stop", role: .destructive) {
        store.interrupt(thread)
      }
    }
  }
}
