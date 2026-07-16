/**
 * ZaloClaw plugin bridge — a small, stable surface that sibling OpenClaw
 * plugins (e.g. dashboards / moderation layers like openclaw-zalo-mod) can use
 * to execute ZaloClaw actions programmatically, without importing this
 * package's bundled `dist` internals or patching files on disk.
 *
 * Exposure: assigned to `globalThis.__zaloclawBridgeService` during
 * `register()`. This is an explicit, documented handshake for same-process
 * plugins. When the OpenClaw plugin SDK ships a first-class cross-plugin
 * service registry, this can move there without changing the interface.
 */

import { executeZaloClawTool, ACTIONS } from "../tools/tool.js";
import { getCurrentUid, isAuthenticated } from "../client/zalo-client.js";

export type ZaloClawBridgeAction = { action: string } & Record<string, unknown>;

export type ZaloClawBridgeService = {
  /** Bridge interface version — bump on breaking changes. */
  version: 1;
  getStatus(accountId?: string): Promise<{
    connected: boolean;
    accountId?: string;
    channel: "zaloclaw";
  }>;
  /** Action names supported by this runtime (consumers derive capabilities). */
  listActions(accountId?: string): Promise<string[]>;
  /**
   * Execute one ZaloClaw action. `action` uses the exact same parameters as
   * the `zaloclaw` agent tool (threadId, message, isGroup, ...).
   * Returns the tool result's structured `details` when available.
   */
  executeAction(accountId: string | undefined, action: ZaloClawBridgeAction): Promise<unknown>;
};

let seq = 0;

export function createBridgeService(): ZaloClawBridgeService {
  return {
    version: 1,

    async getStatus() {
      return {
        connected: isAuthenticated(),
        accountId: getCurrentUid() ?? undefined,
        channel: "zaloclaw",
      };
    },

    async listActions() {
      return [...ACTIONS];
    },

    async executeAction(_accountId, action) {
      if (!action || typeof action.action !== "string" || action.action.length === 0) {
        throw new Error("bridge executeAction: missing action name");
      }
      const result = await executeZaloClawTool(`bridge-${++seq}`, action as never);
      return (result as { details?: unknown }).details ?? result;
    },
  };
}

export function exposeBridgeService(): ZaloClawBridgeService {
  const service = createBridgeService();
  (globalThis as Record<string, unknown>).__zaloclawBridgeService = service;
  return service;
}
