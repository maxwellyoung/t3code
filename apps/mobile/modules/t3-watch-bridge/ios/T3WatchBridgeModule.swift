import ExpoModulesCore

public final class T3WatchBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("T3WatchBridge")

    Events("onWatchCommand", "onReachabilityChange")

    OnCreate {
      WatchSessionCoordinator.shared.activate()
    }

    OnStartObserving {
      WatchSessionCoordinator.shared.onCommand = { [weak self] json in
        self?.sendEvent("onWatchCommand", ["json": json])
      }
      WatchSessionCoordinator.shared.onReachabilityChange = { [weak self] reachable in
        self?.sendEvent("onReachabilityChange", ["reachable": reachable])
      }
    }

    OnStopObserving {
      WatchSessionCoordinator.shared.onCommand = nil
      WatchSessionCoordinator.shared.onReachabilityChange = nil
    }

    Function("getStatus") { () -> [String: Any] in
      let coordinator = WatchSessionCoordinator.shared
      return [
        "supported": coordinator.isSupported,
        "paired": coordinator.isPaired,
        "watchAppInstalled": coordinator.isWatchAppInstalled,
        "reachable": coordinator.isReachable,
      ]
    }

    Function("updateSnapshot") { (json: String) in
      try WatchSessionCoordinator.shared.updateSnapshot(json)
    }

    Function("sendMessage") { (json: String) in
      WatchSessionCoordinator.shared.send(json)
    }
  }
}
