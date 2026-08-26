import Combine
import Foundation
import WatchConnectivity
import WatchKit

/// Feedback for the last command sent from a thread screen.
struct WatchFeedback: Equatable {
  let ok: Bool
  let text: String
}

/// Owns the watch side of the Watch Connectivity session and the last-known
/// snapshot. The phone is the source of truth; the watch only renders and
/// sends commands.
final class WatchStore: NSObject, ObservableObject, WCSessionDelegate {
  @Published private(set) var snapshot: WatchSnapshot?
  @Published private(set) var isReachable = false
  @Published private(set) var feedbackByThreadId: [String: WatchFeedback] = [:]
  @Published private(set) var inFlightThreadIds: Set<String> = []

  private static let snapshotDefaultsKey = "t3code.watch.snapshot"
  private static let commandTimeout: TimeInterval = 25

  private var threadIdByCommandId: [String: String] = [:]
  private let decoder = JSONDecoder()

  override init() {
    super.init()
    restoreSnapshot()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  var threads: [WatchThread] { snapshot?.threads ?? [] }
  var quickReplies: [String] { snapshot?.quickReplies ?? [] }

  func thread(id: String) -> WatchThread? {
    threads.first { $0.id == id }
  }

  // MARK: - Commands

  func respond(to approval: WatchApproval, decision: String, in thread: WatchThread) {
    send(
      [
        "type": "respondToApproval",
        "requestId": approval.requestId,
        "decision": decision,
      ],
      thread: thread
    )
  }

  func answer(_ input: WatchUserInput, answers: [String: Any], in thread: WatchThread) {
    send(
      [
        "type": "respondToUserInput",
        "requestId": input.requestId,
        "answers": answers,
      ],
      thread: thread
    )
  }

  func reply(_ text: String, in thread: WatchThread) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    send(["type": "sendMessage", "text": trimmed], thread: thread)
  }

  func interrupt(_ thread: WatchThread) {
    send(["type": "interruptTurn"], thread: thread)
  }

  func requestSnapshot() {
    guard WCSession.isSupported(), WCSession.default.isReachable else { return }
    deliver(["command": encode(["type": "requestSnapshot"])], queueIfUnreachable: false)
  }

  private func send(_ fields: [String: Any], thread: WatchThread) {
    let commandId = UUID().uuidString
    var command = fields
    command["commandId"] = commandId
    command["environmentId"] = thread.environmentId
    command["threadId"] = thread.threadId

    threadIdByCommandId[commandId] = thread.id
    inFlightThreadIds.insert(thread.id)
    feedbackByThreadId[thread.id] = nil
    WKInterfaceDevice.current().play(.click)

    deliver(["command": encode(command)], queueIfUnreachable: true)

    DispatchQueue.main.asyncAfter(deadline: .now() + Self.commandTimeout) { [weak self] in
      guard let self, let threadId = self.threadIdByCommandId.removeValue(forKey: commandId) else {
        return
      }
      self.inFlightThreadIds.remove(threadId)
      // Queued delivery still completes once the phone wakes; say so rather
      // than claiming failure.
      self.feedbackByThreadId[threadId] = WatchFeedback(ok: true, text: "Sent to iPhone")
    }
  }

  private func deliver(_ payload: [String: Any], queueIfUnreachable: Bool) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { _ in
        if queueIfUnreachable {
          session.transferUserInfo(payload)
        }
      }
    } else if queueIfUnreachable {
      session.transferUserInfo(payload)
    }
  }

  private func encode(_ value: [String: Any]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: value),
      let json = String(data: data, encoding: .utf8)
    else {
      return "{}"
    }
    return json
  }

  // MARK: - Incoming

  private func applySnapshot(json: String, persist: Bool) {
    guard let data = json.data(using: .utf8),
      let decoded = try? decoder.decode(WatchSnapshot.self, from: data),
      decoded.version == WatchSnapshot.supportedVersion
    else {
      return
    }
    DispatchQueue.main.async {
      self.snapshot = decoded
      if persist {
        UserDefaults.standard.set(json, forKey: Self.snapshotDefaultsKey)
      }
    }
  }

  private func restoreSnapshot() {
    guard let json = UserDefaults.standard.string(forKey: Self.snapshotDefaultsKey) else { return }
    applySnapshot(json: json, persist: false)
  }

  private func handleMessage(_ payload: [String: Any]) {
    if let json = payload["snapshot"] as? String {
      applySnapshot(json: json, persist: true)
      return
    }
    guard let json = payload["message"] as? String,
      let data = json.data(using: .utf8),
      let result = try? decoder.decode(WatchCommandResult.self, from: data),
      result.type == "commandResult"
    else {
      return
    }
    DispatchQueue.main.async {
      guard let threadId = self.threadIdByCommandId.removeValue(forKey: result.commandId) else {
        return
      }
      self.inFlightThreadIds.remove(threadId)
      self.feedbackByThreadId[threadId] = WatchFeedback(
        ok: result.ok,
        text: result.ok ? "Done" : (result.error ?? "Failed")
      )
      WKInterfaceDevice.current().play(result.ok ? .success : .failure)
    }
  }

  // MARK: - WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
    }
    if let json = session.receivedApplicationContext["snapshot"] as? String {
      applySnapshot(json: json, persist: true)
    }
    requestSnapshot()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
    }
    if session.isReachable {
      requestSnapshot()
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handleMessage(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleMessage(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handleMessage(userInfo)
  }
}
