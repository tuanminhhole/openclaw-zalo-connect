import { describe, expect, it } from "vitest";
import { createBridgeService, exposeBridgeService, publishBridgeInbound } from "../src/runtime/bridge.js";
import { clearAllRuntimeGroupPolicies } from "../src/runtime/group-policy.js";
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
    expect(service.version).toBe(2);
    delete (globalThis as Record<string, unknown>).__zaloConnectBridgeService;
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
    publishBridgeInbound(event);
    await Promise.resolve();
    expect(seen).toEqual(["m1"]);
    unsubscribe();
    publishBridgeInbound({ ...event, messageId: "m2" });
    await Promise.resolve();
    expect(seen).toEqual(["m1"]);
  });
});
