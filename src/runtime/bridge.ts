/**
 * ZaloConnect plugin bridge — a small, stable surface that sibling OpenClaw
 * plugins (e.g. dashboards / moderation layers like openclaw-zalo-mod) can use
 * to execute ZaloConnect actions programmatically, without importing this
 * package's bundled `dist` internals or patching files on disk.
 *
 * Exposure: assigned to `globalThis.__zaloConnectBridgeService` during
 * `register()`. This is an explicit, documented handshake for same-process
 * plugins. When the OpenClaw plugin SDK ships a first-class cross-plugin
 * service registry, this can move there without changing the interface.
 */

import { executeZaloConnectTool, ACTIONS } from "../tools/tool.js";
import { getCurrentUid, isAuthenticated } from "../client/zalo-client.js";
import {
  clearRuntimeGroupPolicy,
  getRuntimeGroupPolicy,
  setRuntimeGroupPolicy,
  type RuntimeGroupMode,
  type RuntimeGroupPolicy,
} from "./group-policy.js";

export type ZaloConnectBridgeAction = { action: string } & Record<string, unknown>;

export type ZaloConnectBridgeInboundEvent = {
  accountId: string;
  conversationId: string;
  groupId?: string;
  isGroup: boolean;
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  mentions?: Array<{ uid: string; displayName?: string }>;
  quote?: { messageId?: string; senderId?: string; text?: string };
};

type InboundHandler = (event: ZaloConnectBridgeInboundEvent) => void | Promise<void>;
const inboundHandlers = new Set<InboundHandler>();

/**
 * Publish an allowed inbound message to sibling plugins before mention gating.
 * Handlers are isolated and never delay or break the channel pipeline.
 */
export function publishBridgeInbound(event: ZaloConnectBridgeInboundEvent): void {
  for (const handler of inboundHandlers) {
    try {
      void Promise.resolve(handler(event)).catch((err) => {
        console.warn(`[zalo-connect] bridge inbound subscriber failed: ${String(err)}`);
      });
    } catch (err) {
      console.warn(`[zalo-connect] bridge inbound subscriber failed: ${String(err)}`);
    }
  }
}

export type ZaloConnectBridgeService = {
  /** Version 2 adds live group-policy overrides (additive to v1). */
  version: 2;
  getStatus(accountId?: string): Promise<{
    connected: boolean;
    accountId?: string;
    channel: "zalo-connect";
  }>;
  /** Action names supported by this runtime (consumers derive capabilities). */
  listActions(accountId?: string): Promise<string[]>;
  /**
   * Execute one ZaloConnect action. `action` uses the exact same parameters as
   * the `zalo-connect` agent tool (threadId, message, isGroup, ...).
   * Returns the tool result's structured `details` when available.
   */
  executeAction(accountId: string | undefined, action: ZaloConnectBridgeAction): Promise<unknown>;
  /**
   * Override inbound gating in memory. This never writes openclaw.json and
   * therefore never restarts the gateway. The channel checks it before relay.
   */
  setGroupPolicy(accountId: string | undefined, groupId: string, mode: RuntimeGroupMode): Promise<RuntimeGroupPolicy>;
  getGroupPolicy(accountId: string | undefined, groupId: string): Promise<RuntimeGroupPolicy | undefined>;
  clearGroupPolicy(accountId: string | undefined, groupId: string): Promise<boolean>;
  /** Receive allowed inbound messages before silent/mention gating (zero-token). */
  subscribeInbound(handler: InboundHandler): () => void;
};

let seq = 0;

export function createBridgeService(): ZaloConnectBridgeService {
  return {
    version: 2,

    async getStatus(accountId) {
      return {
        connected: isAuthenticated(accountId),
        accountId: getCurrentUid(accountId) ?? accountId,
        channel: "zalo-connect",
      };
    },

    async listActions() {
      return [...ACTIONS];
    },

    async executeAction(accountId, action) {
      if (!action || typeof action.action !== "string" || action.action.length === 0) {
        throw new Error("bridge executeAction: missing action name");
      }
      const result = await executeZaloConnectTool(
        `bridge-${++seq}`,
        { ...action, accountId: accountId || "default" } as never,
      );
      return (result as { details?: unknown }).details ?? result;
    },

    async setGroupPolicy(accountId, groupId, mode) {
      return setRuntimeGroupPolicy(accountId, groupId, mode);
    },

    async getGroupPolicy(accountId, groupId) {
      return getRuntimeGroupPolicy(accountId, groupId);
    },

    async clearGroupPolicy(accountId, groupId) {
      return clearRuntimeGroupPolicy(accountId, groupId);
    },

    subscribeInbound(handler) {
      inboundHandlers.add(handler);
      return () => inboundHandlers.delete(handler);
    },
  };
}

export function exposeBridgeService(): ZaloConnectBridgeService {
  const service = createBridgeService();
  (globalThis as Record<string, unknown>).__zaloConnectBridgeService = service;
  return service;
}
