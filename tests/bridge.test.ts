import { describe, expect, it } from "vitest";
import {
  createBridgeService,
  exposeBridgeService,
  publishBridgeInbound,
  publishBridgeHistory,
  hasBridgeHistorySubscribers,
  type ZaloConnectBridgeHistoryEvent,
} from "../src/runtime/bridge.js";
import { clearAllRuntimeGroupPolicies } from "../src/runtime/group-policy.js";
import { clearAllRuntimeNameTriggers } from "../src/runtime/name-triggers.js";
import { ACTIONS } from "../src/tools/tool.js";

describe("plugin bridge service", () => {
  it("reports status without an authenticated session", async () => {
    const bridge = createBridgeService();
    const status = await bridge.getStatus();
    expect(status.channel).toBe("zalo-connect");
    expect(typeof status.connected).toBe("boolean");
  });

  it("lists the same actions as the agent tool", async () => {
    const bridge = createBridgeService();
    const actions = await bridge.listActions();
    expect(actions).toEqual([...ACTIONS]);
    expect(actions).toContain("send");
    expect(actions.length).toBeGreaterThan(100);
    // returned array is a copy — mutating it must not affect the tool
    actions.pop();
    expect((await bridge.listActions()).length).toBe(ACTIONS.length);
  });

  it("rejects an action without a name", async () => {
    const bridge = createBridgeService();
    await expect(bridge.executeAction(undefined, {} as never)).rejects.toThrow(/missing action name/);
  });

  it("surfaces tool-level errors as structured results, not throws", async () => {
    const bridge = createBridgeService();
    // no session is logged in during tests → the tool reports an error payload
    const result = (await bridge.executeAction(undefined, { action: "me" })) as {
      error?: boolean;
      message?: string;
    };
    expect(result?.error).toBe(true);
    expect(typeof result?.message).toBe("string");
  });

  it("exposes the service on the documented global handshake", () => {
    const service = exposeBridgeService();
    expect((globalThis as Record<string, unknown>).__zaloConnectBridgeService).toBe(service);
    expect(service.version).toBe(5);
    delete (globalThis as Record<string, unknown>).__zaloConnectBridgeService;
  });

  // ── Kênh lịch sử chat (v5) ────────────────────────────────────────────────

  const histEvent = (over: Partial<ZaloConnectBridgeHistoryEvent> = {}): ZaloConnectBridgeHistoryEvent => ({
    accountId: "default",
    conversationId: "t-1",
    isGroup: false,
    messageId: "m-1",
    senderId: "u-1",
    senderName: "Khách",
    text: "tin cũ",
    timestamp: 1_700_000_000_000,
    fromSelf: false,
    ...over,
  });

  it("lịch sử đi kênh RIÊNG: người đăng ký inbound KHÔNG nhận được tin cũ", async () => {
    const bridge = createBridgeService();
    const inbound: unknown[] = [];
    const history: unknown[] = [];
    const offIn = bridge.subscribeInbound((e) => { inbound.push(e); });
    const offHist = bridge.subscribeHistory!((batch) => { history.push(...batch); });

    await publishBridgeHistory([histEvent(), histEvent({ messageId: "m-2" })]);

    // Đây là tính chất giữ cho bot KHÔNG trả lời hàng trăm tin cũ khi kéo lịch sử về.
    expect(inbound).toHaveLength(0);
    expect(history).toHaveLength(2);
    offIn();
    offHist();
  });

  it("không ai đăng ký thì không phát, và bỏ đăng ký là ngừng nhận", async () => {
    const bridge = createBridgeService();
    expect(hasBridgeHistorySubscribers()).toBe(false);
    await publishBridgeHistory([histEvent()]);   // không được ném

    const seen: unknown[] = [];
    const off = bridge.subscribeHistory!((batch) => { seen.push(...batch); });
    expect(hasBridgeHistorySubscribers()).toBe(true);
    await publishBridgeHistory([histEvent()]);
    off();
    expect(hasBridgeHistorySubscribers()).toBe(false);
    await publishBridgeHistory([histEvent({ messageId: "m-sau-khi-huy" })]);
    expect(seen).toHaveLength(1);
  });

  it("một người nghe ném lỗi thì người còn lại vẫn nhận đủ", async () => {
    const bridge = createBridgeService();
    const seen: unknown[] = [];
    const offBad = bridge.subscribeHistory!(() => { throw new Error("hỏng"); });
    const offGood = bridge.subscribeHistory!((batch) => { seen.push(...batch); });
    await expect(publishBridgeHistory([histEvent()])).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
    offBad();
    offGood();
  });

  it("có action request-old-messages trong danh sách", async () => {
    const bridge = createBridgeService();
    expect(await bridge.listActions()).toContain("request-old-messages");
  });

  it("applies free/silent/mute policy in memory without config writes", async () => {
    clearAllRuntimeGroupPolicies();
    const bridge = createBridgeService();

    expect(await bridge.setGroupPolicy("acc1", "group:g1", "free")).toMatchObject({
      mode: "free", enabled: true, requireMention: false,
    });
    expect(await bridge.getGroupPolicy("acc1", "g1")).toMatchObject({ mode: "free" });

    expect(await bridge.setGroupPolicy("acc1", "g1", "silent")).toMatchObject({
      mode: "silent", enabled: true, requireMention: true,
    });
    expect(await bridge.setGroupPolicy("acc1", "g1", "mute")).toMatchObject({
      mode: "mute", enabled: false, requireMention: true,
    });

    expect(await bridge.getGroupPolicy("acc2", "g1")).toBeUndefined();
    expect(await bridge.clearGroupPolicy("acc1", "g1")).toBe(true);
    expect(await bridge.getGroupPolicy("acc1", "g1")).toBeUndefined();
  });

  it("stores and de-dupes runtime name-trigger aliases in memory", async () => {
    clearAllRuntimeNameTriggers();
    const bridge = createBridgeService();

    // No session → no display name; runtime aliases start empty.
    const initial = await bridge.getNameTriggers("acc1");
    expect(initial.triggers).toEqual([]);
    expect(initial.effective).toEqual([]);

    const set = await bridge.setNameTriggers("acc1", ["  Mkt ", "mei", "mkt", ""]);
    // trimmed, blanks dropped, case-insensitive de-dupe, first spelling kept
    expect(set.triggers).toEqual(["Mkt", "mei"]);
    expect(await bridge.getNameTriggers("acc1")).toMatchObject({ triggers: ["Mkt", "mei"] });

    // Per-account isolation: acc2 untouched.
    expect((await bridge.getNameTriggers("acc2")).triggers).toEqual([]);

    // Empty list clears the override.
    expect((await bridge.setNameTriggers("acc1", [])).triggers).toEqual([]);
    expect((await bridge.getNameTriggers("acc1")).triggers).toEqual([]);
  });

  it("rejects invalid runtime group policy", async () => {
    const bridge = createBridgeService();
    await expect(bridge.setGroupPolicy("acc1", "", "free")).rejects.toThrow(/groupId required/);
    await expect(bridge.setGroupPolicy("acc1", "g1", "other" as never)).rejects.toThrow(/invalid group mode/);
  });

  it("publishes inbound to subscribers before silent gating and supports unsubscribe", async () => {
    const bridge = createBridgeService();
    const seen: string[] = [];
    const unsubscribe = bridge.subscribeInbound((event) => seen.push(event.messageId));
    const event = {
      accountId: "acc1", conversationId: "group:g1", groupId: "g1", isGroup: true,
      messageId: "m1", senderId: "u1", senderName: "An", text: "mấy giờ rồi",
      timestamp: Date.now(),
    };
    expect(await publishBridgeInbound(event)).toBe(false);
    expect(seen).toEqual(["m1"]);
    unsubscribe();
    expect(await publishBridgeInbound({ ...event, messageId: "m2" })).toBe(false);
    expect(seen).toEqual(["m1"]);
  });

  it("lets a sibling plugin claim a command before mention/agent dispatch", async () => {
    const bridge = createBridgeService();
    const unsubscribe = bridge.subscribeInbound((event) => (
      event.text.startsWith("/bot-") ? { handled: true } : undefined
    ));
    const base = {
      accountId: "acc1", conversationId: "group:g1", groupId: "g1", isGroup: true,
      messageId: "m-command", senderId: "u1", senderName: "An", timestamp: Date.now(),
    };
    expect(await publishBridgeInbound({ ...base, text: "/bot-menu" })).toBe(true);
    expect(await publishBridgeInbound({ ...base, messageId: "m-chat", text: "alo" })).toBe(false);
    unsubscribe();
  });
});
