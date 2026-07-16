import type { PluginRuntime } from "openclaw/plugin-sdk/channel-plugin-common";

let runtime: PluginRuntime | null = null;

export function setZaloConnectRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getZaloConnectRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("ZaloConnect runtime not initialized");
  }
  return runtime;
}
