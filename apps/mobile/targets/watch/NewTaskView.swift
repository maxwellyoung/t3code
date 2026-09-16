import SwiftUI

/// Starts a task by voice: pick a project, then speak. The phone queues it like
/// a task from its own New Task screen, and it shows up under Working once the
/// phone delivers it.
struct NewTaskView: View {
  @EnvironmentObject private var store: WatchStore

  var body: some View {
    Group {
      if store.projects.isEmpty {
        Text("Start a thread in a project on your iPhone first.")
          .font(.footnote)
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
          .padding()
      } else if store.projects.count == 1, let project = store.projects.first {
        NewTaskPrompt(project: project)
      } else {
        List(store.projects) { project in
          NavigationLink {
            NewTaskPrompt(project: project)
          } label: {
            Text(project.title).lineLimit(2)
          }
        }
      }
    }
    .navigationTitle("New task")
  }
}

private struct NewTaskPrompt: View {
  @EnvironmentObject private var store: WatchStore
  let project: WatchProject

  var body: some View {
    List {
      Section {
        TextFieldLink(prompt: Text("Describe the task")) {
          Label("Speak task", systemImage: "mic.fill")
        } onSubmit: { text in
          store.startTask(text, in: project)
        }
        .disabled(store.isStartingTask)
      } footer: {
        Text("Runs in the current checkout.")
      }
      if store.isStartingTask {
        ProgressView()
          .frame(maxWidth: .infinity)
          .listRowBackground(Color.clear)
      } else if let feedback = store.newTaskFeedback {
        Label(
          feedback.text,
          systemImage: feedback.ok ? "checkmark.circle.fill" : "xmark.octagon.fill"
        )
        .font(.caption)
        .foregroundStyle(feedback.ok ? Color.green : Color.red)
        .listRowBackground(Color.clear)
      }
    }
    .navigationTitle(project.title)
    .onAppear { store.clearNewTaskFeedback() }
  }
}
