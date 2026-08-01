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
import { getCurrentUid, getCurrentName, isAuthenticated } from "../client/zalo-client.js";
import {
  clearRuntimeGroupPolicy,
  getRuntimeGroupPolicy,
  setRuntimeGroupPolicy,
  type RuntimeGroupMode,
  type RuntimeGroupPolicy,
} from "./group-policy.js";
import { getRuntimeNameTriggers, setRuntimeNameTriggers } from "./name-triggers.js";

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

/**
 * Một tin nhắn CŨ kéo về từ Zalo — kênh RIÊNG, tuyệt đối không dùng chung với inbound.
 *
 * Vì sao tách hẳn thay vì thêm một cờ vào `ZaloConnectBridgeInboundEvent`: đường inbound đi thẳng
 * vào cổng mention rồi dispatch cho model. Một lần kéo lịch sử là hàng trăm tin đổ về cùng lúc —
 * lọt vào đường đó thì bot trả lời hàng loạt tin từ tuần trước, gửi thật vào nhóm khách. Kiểu tách
 * này khiến lỗi đó không thể xảy ra do nhầm lẫn, chứ không dựa vào việc ai đó nhớ kiểm cờ.
 *
 * `fromSelf` phân biệt tin của chính bot với tin của người khác — khung chat cần nó để vẽ trái/phải,
 * và `old_messages` trả về cả hai chiều (khác đường inbound vốn đã lọc bỏ tin tự gửi).
 */
export type ZaloConnectBridgeHistoryEvent = {
  accountId: string;
  conversationId: string;
  groupId?: string;
  isGroup: boolean;
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  fromSelf: boolean;
  mediaUrls?: string[];
};

export type ZaloConnectBridgeInboundOutcome = void | boolean | { handled?: boolean };
type InboundHandler = (
  event: ZaloConnectBridgeInboundEvent,
) => ZaloConnectBridgeInboundOutcome | Promise<ZaloConnectBridgeInboundOutcome>;
const inboundHandlers = new Set<InboundHandler>();

/**
 * Publish an allowed inbound message to sibling plugins before mention gating.
 * Handlers are isolated. Returning `true` or `{ handled: true }` claims the
 * message before mention gating/agent dispatch (used by zero-token slash
 * command plugins). Passive subscribers simply return nothing.
 */
export async function publishBridgeInbound(event: ZaloConnectBridgeInboundEvent): Promise<boolean> {
  let handled = false;
  for (const handler of inboundHandlers) {
    try {
      const outcome = await handler(event);
      if (outcome === true || (outcome && typeof outcome === "object" && outcome.handled === true)) {
        handled = true;
      }
    } catch (err) {
      console.warn(`[zalo-connect] bridge inbound subscriber failed: ${String(err)}`);
    }
  }
  return handled;
}

type HistoryHandler = (
  events: ZaloConnectBridgeHistoryEvent[],
) => void | Promise<void>;
const historyHandlers = new Set<HistoryHandler>();

/**
 * Đẩy một LÔ tin cũ sang plugin anh em. Không có giá trị trả về và không ai "claim" được lô này:
 * lịch sử chỉ để lưu lại, không phải thứ để phản hồi.
 *
 * Đẩy theo lô chứ không từng tin: Zalo trả về hàng trăm tin trong một sự kiện, gọi handler mỗi tin
 * là bên kia phải mở/đóng transaction hàng trăm lần.
 */
export async function publishBridgeHistory(events: ZaloConnectBridgeHistoryEvent[]): Promise<void> {
  if (!events.length || historyHandlers.size === 0) return;
  for (const handler of historyHandlers) {
    try {
      await handler(events);
    } catch (err) {
      console.warn(`[zalo-connect] bridge history subscriber failed: ${String(err)}`);
    }
  }
}

/** Có ai đang lắng nghe lịch sử không — dùng để khỏi tốn công chuyển đổi khi không ai cần. */
export function hasBridgeHistorySubscribers(): boolean {
  return historyHandlers.size > 0;
}

/** Silent-mode name gate view: the bot's own display name plus runtime aliases. */
export type ZaloConnectNameTriggers = {
  /** The bot's own Zalo display name for this account (auto, read-only). */
  displayName: string | null;
  /** Runtime alias overrides pushed by a control plugin (editable). */
  triggers: string[];
  /** What actually gates: displayName + triggers, de-duped. */
  effective: string[];
};

function readNameTriggers(accountId?: string): ZaloConnectNameTriggers {
  const displayName = getCurrentName(accountId);
  const triggers = getRuntimeNameTriggers(accountId);
  const seen = new Set<string>();
  const effective: string[] = [];
  for (const raw of [displayName, ...triggers]) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    effective.push(value);
  }
  return { displayName, triggers, effective };
}

export type ZaloConnectBridgeService = {
  /** Version 5 adds the chat-history channel (additive to v4). */
  version: 5;
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
  /**
   * Read the silent-mode name gate for an account: the bot's own Zalo display
   * name (auto) plus the runtime alias overrides addressing it by name.
   */
  getNameTriggers(accountId?: string): Promise<ZaloConnectNameTriggers>;
  /**
   * Replace the runtime alias overrides for this account. In-memory only: never
   * writes openclaw.json, so the gateway never restarts and the new aliases
   * gate on the very next message. Persistence belongs to the caller, which
   * replays its aliases after a real gateway restart.
   */
  setNameTriggers(accountId: string | undefined, triggers: string[]): Promise<ZaloConnectNameTriggers>;
  /** Receive allowed inbound messages before silent/mention gating (zero-token). */
  subscribeInbound(handler: InboundHandler): () => void;
  /**
   * v5: nhận LỊCH SỬ chat kéo về từ Zalo (`request-old-messages`). Kênh riêng, không đi qua cổng
   * mention và không dispatch cho model — tin cũ chỉ để lưu lại.
   */
  subscribeHistory?(handler: HistoryHandler): () => void;
};

let seq = 0;

export function createBridgeService(): ZaloConnectBridgeService {
  return {
    version: 5,

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

    async getNameTriggers(accountId) {
      return readNameTriggers(accountId);
    },

    async setNameTriggers(accountId, triggers) {
      setRuntimeNameTriggers(accountId, triggers);
      return readNameTriggers(accountId);
    },

    subscribeInbound(handler) {
      inboundHandlers.add(handler);
      return () => inboundHandlers.delete(handler);
    },

    subscribeHistory(handler) {
      historyHandlers.add(handler);
      return () => historyHandlers.delete(handler);
    },
  };
}

export function exposeBridgeService(): ZaloConnectBridgeService {
  const service = createBridgeService();
  (globalThis as Record<string, unknown>).__zaloConnectBridgeService = service;
  return service;
}
