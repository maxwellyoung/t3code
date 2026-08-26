import SwiftUI

/// One thread: what it needs from you first, then the fastest ways to keep it
/// moving (quick replies), then dictation and stop as fallbacks.
struct ThreadDetailView: View {
  @EnvironmentObject private var store: WatchStore
  let threadId: String

  @State private var draft = ""
  @State private var selections: [String: Set<String>] = [:]

  var body: some View {
    if let thread = store.thread(id: threadId) {
      detail(thread)
    } else {
      Text("This task is no longer listed.")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding()
    }
  }

  private func detail(_ thread: WatchThread) -> some View {
    let inFlight = store.inFlightThreadIds.contains(thread.id)
    return List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(thread.threadTitle)
            .font(.headline)
          Text("\(thread.projectTitle) · \(thread.modelTitle)")
            .font(.caption2)
            .foregroundStyle(.secondary)
          HStack(spacing: 6) {
            Circle().fill(thread.resolvedPhase.tint).frame(width: 8, height: 8)
            Text(thread.headline).font(.caption)
          }
          if let detail = thread.detail {
            Text(detail)
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        }
      }
      .listRowBackground(Color.clear)

      if let feedback = store.feedbackByThreadId[thread.id] {
        Section {
          Label(feedback.text, systemImage: feedback.ok ? "checkmark.circle.fill" : "xmark.octagon.fill")
            .font(.caption)
            .foregroundStyle(feedback.ok ? .green : .red)
        }
        .listRowBackground(Color.clear)
      }

      ForEach(thread.approvals) { approval in
        Section(approvalTitle(approval)) {
          if let detail = approval.detail {
            Text(detail)
              .font(.system(.caption2, design: .monospaced))
              .lineLimit(6)
          }
          ForEach(approval.options, id: \.decision) { option in
            Button(option.label) {
              store.respond(to: approval, decision: option.decision, in: thread)
            }
            .tint(option.isAffirmative ? .green : .red)
            .buttonStyle(.borderedProminent)
          }
        }
      }

      ForEach(thread.userInputs) { input in
        ForEach(input.questions) { question in
          Section(question.header) {
            Text(question.question).font(.caption)
            ForEach(question.options) { option in
              Button {
                choose(option.label, for: question, in: input, thread: thread)
              } label: {
                HStack {
                  VStack(alignment: .leading, spacing: 2) {
                    Text(option.label).font(.body)
                    if let description = option.description {
                      Text(description).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                    }
                  }
                  Spacer(minLength: 0)
                  if isSelected(option.label, question: question) {
                    Image(systemName: "checkmark").foregroundStyle(.tint)
                  }
                }
              }
            }
          }
        }
        if needsSendButton(input) {
          Section {
            Button("Send answers") {
              store.answer(input, answers: collectedAnswers(input), in: thread)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!allAnswered(input))
          }
        }
      }

      Section("Reply") {
        ForEach(Array(store.quickReplies.enumerated()), id: \.offset) { index, reply in
          Button(reply) {
            store.reply(reply, in: thread)
          }
          .buttonStyle(index == 0 ? .borderedProminent : .bordered)
        }
        TextField("Dictate…", text: $draft)
          .onSubmit {
            store.reply(draft, in: thread)
            draft = ""
          }
      }

      if thread.resolvedPhase.isActive {
        Section {
          Button("Stop", role: .destructive) {
            store.interrupt(thread)
          }
        }
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

  private func approvalTitle(_ approval: WatchApproval) -> String {
    switch approval.requestKind {
    case "command": return "Run command?"
    case "file-read": return "Read file?"
    case "file-change": return "Change file?"
    default: return "Approve?"
    }
  }

  // MARK: - Questions

  private func isSelected(_ label: String, question: WatchQuestion) -> Bool {
    selections[question.id]?.contains(label) ?? false
  }

  private func choose(_ label: String, for question: WatchQuestion, in input: WatchUserInput, thread: WatchThread) {
    var chosen = selections[question.id] ?? []
    if question.multiSelect {
      if chosen.contains(label) { chosen.remove(label) } else { chosen.insert(label) }
    } else {
      chosen = [label]
    }
    selections[question.id] = chosen

    // The common case — one single-choice question — sends on tap; anything
    // needing a second decision waits for the explicit button.
    if !needsSendButton(input) {
      store.answer(input, answers: collectedAnswers(input), in: thread)
    }
  }

  private func needsSendButton(_ input: WatchUserInput) -> Bool {
    input.questions.count > 1 || input.questions.contains { $0.multiSelect }
  }

  private func allAnswered(_ input: WatchUserInput) -> Bool {
    input.questions.allSatisfy { !(selections[$0.id] ?? []).isEmpty }
  }

  private func collectedAnswers(_ input: WatchUserInput) -> [String: Any] {
    var answers: [String: Any] = [:]
    for question in input.questions {
      let chosen = selections[question.id] ?? []
      if question.multiSelect {
        answers[question.id] = question.options.map(\.label).filter { chosen.contains($0) }
      } else if let single = chosen.first {
        answers[question.id] = single
      }
    }
    return answers
  }
}
