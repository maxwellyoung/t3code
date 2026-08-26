import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface EventSubscription {
  remove(): void;
}

export interface WatchBridgeStatus {
  readonly supported: boolean;
  readonly paired: boolean;
  readonly watchAppInstalled: boolean;
  readonly reachable: boolean;
}

interface WatchBridgeNativeModule {
  getStatus(): WatchBridgeStatus;
  updateSnapshot(json: string): void;
  sendMessage(json: string): void;
  addListener(
    eventName: "onWatchCommand",
    listener: (event: { readonly json: string }) => void,
  ): EventSubscription;
  addListener(
    eventName: "onReachabilityChange",
    listener: (event: { readonly reachable: boolean }) => void,
  ): EventSubscription;
}

let cachedModule: WatchBridgeNativeModule | null | undefined;

/**
 * The bridge is iOS-only and absent from builds that omit the native module
 * (Android, Personal Team builds without the watch target, tests).
 */
export function resolveWatchBridge(): WatchBridgeNativeModule | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  if (Platform.OS !== "ios" || typeof requireOptionalNativeModule !== "function") {
    cachedModule = null;
    return cachedModule;
  }
  cachedModule = requireOptionalNativeModule<WatchBridgeNativeModule>("T3WatchBridge") ?? null;
  return cachedModule;
}
