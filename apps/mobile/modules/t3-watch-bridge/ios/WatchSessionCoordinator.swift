import Foundation
import WatchConnectivity

/// Owns the phone side of the Watch Connectivity session.
///
/// The session is activated from the app delegate, not from the Expo module,
/// because a watch command can launch the iPhone app in the background and
/// WatchConnectivity delivers it before the JS runtime has attached a
/// listener. Commands received before JS is observing are buffered and
/// flushed once the module starts observing.
final class WatchSessionCoordinator: NSObject, WCSessionDelegate {
  static let shared = WatchSessionCoordinator()

  var onCommand: ((String) -> Void)? {
    didSet { flushPendingCommands() }
  }
  var onReachabilityChange: ((Bool) -> Void)?

  private let lock = NSLock()
  private var pendingCommands: [String] = []
  private var activated = false

  private var session: WCSession? {
    WCSession.isSupported() ? WCSession.default : nil
  }

  var isSupported: Bool { WCSession.isSupported() }
  var isPaired: Bool { session?.isPaired ?? false }
  var isWatchAppInstalled: Bool { session?.isWatchAppInstalled ?? false }
  var isReachable: Bool { session?.isReachable ?? false }
  var isActivated: Bool { session?.activationState == .activated }

  func activate() {
    guard let session, !activated else { return }
    activated = true
    session.delegate = self
    session.activate()
  }

  /// Replaces the watch's last-known state. Application context survives the
  /// phone app being suspended, so the watch always has something to render.
  func updateSnapshot(_ json: String) throws {
    guard let session, session.activationState == .activated else { return }
    try session.updateApplicationContext(["snapshot": json])
  }

  /// Delivers a one-off message (command results). Uses the live channel when
  /// the watch app is in the foreground and queues otherwise.
  func send(_ json: String) {
    guard let session, session.activationState == .activated else { return }
    let payload: [String: Any] = ["message": json]
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { _ in
        session.transferUserInfo(payload)
      }
    } else {
      session.transferUserInfo(payload)
    }
  }

  private func enqueue(_ command: String) {
    lock.lock()
    pendingCommands.append(command)
    lock.unlock()
    flushPendingCommands()
  }

  private func flushPendingCommands() {
    guard let onCommand else { return }
    lock.lock()
    let commands = pendingCommands
    pendingCommands.removeAll()
    lock.unlock()
    guard !commands.isEmpty else { return }
    DispatchQueue.main.async {
      commands.forEach(onCommand)
    }
  }

  private func handleIncoming(_ payload: [String: Any]) {
    guard let command = payload["command"] as? String else { return }
    enqueue(command)
  }

  private func notifyReachability(_ reachable: Bool) {
    DispatchQueue.main.async { [weak self] in
      self?.onReachabilityChange?(reachable)
    }
  }

  // MARK: - WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    notifyReachability(session.isReachable)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // A watch switch deactivates the session; re-activating binds the new watch.
    session.activate()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    notifyReachability(session.isReachable)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleIncoming(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    handleIncoming(message)
    replyHandler(["accepted": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handleIncoming(userInfo)
  }
}
