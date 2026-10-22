import { afterEach, describe, expect, it } from "vitest";
import { createBridgeService } from "../src/runtime/bridge.js";
import {
  DEFAULT_GROUP_ACK_REACTION,
  clearAllRuntimeGroupAckReactions,
  getRuntimeGroupAckReaction,
  resolveAckReactionForMessage,
  setRuntimeGroupAckReaction,
} from "../src/runtime/group-reaction.js";
import { setRuntimeGroupPolicy, clearAllRuntimeGroupPolicies } from "../src/runtime/group-policy.js";
import { readFileSync } from "node:fs";

afterEach(() => {
  clearAllRuntimeGroupAckReactions();
  clearAllRuntimeGroupPolicies();
});

describe("per-group automatic reaction", () => {
  it("follows the global setting when the group has no override", () => {
    expect(resolveAckReactionForMessage({ globalEmoji: "/-heart", globalShouldAck: true, groupOverride: undefined })).toBe("/-heart");
    expect(resolveAckReactionForMessage({ globalEmoji: "/-heart", globalShouldAck: false, groupOverride: undefined })).toBe("");
    expect(resolveAckReactionForMessage({ globalEmoji: "", globalShouldAck: false, groupOverride: undefined })).toBe("");
  });

  it("off silences one group even when the global reaction is on", () => {
    expect(resolveAckReactionForMessage({ globalEmoji: "/-heart", globalShouldAck: true, groupOverride: false })).toBe("");
  });

  it("on reacts in that group even when the global reaction is removed or scoped away", () => {
    // vps_asa 22/10/2026: global reaction removed, owner still wants it in chosen groups.
    expect(resolveAckReactionForMessage({ globalEmoji: "", globalShouldAck: false, groupOverride: true })).toBe(DEFAULT_GROUP_ACK_REACTION);
    expect(resolveAckReactionForMessage({ globalEmoji: ":>", globalShouldAck: false, groupOverride: true })).toBe(":>");
  });

  it("keys the override by account and accepts the group: prefix", () => {
    setRuntimeGroupAckReaction("default", "group:123", false);
    expect(getRuntimeGroupAckReaction("default", "123")).toBe(false);
    expect(getRuntimeGroupAckReaction(undefined, "123")).toBe(false);
    expect(getRuntimeGroupAckReaction("other-bot", "123")).toBeUndefined();
    setRuntimeGroupAckReaction("default", "123", null);
    expect(getRuntimeGroupAckReaction("default", "123")).toBeUndefined();
  });

  it("survives a group mode change (kept apart from RuntimeGroupPolicy)", () => {
    setRuntimeGroupAckReaction("default", "123", false);
    setRuntimeGroupPolicy("default", "123", "silent");
    setRuntimeGroupPolicy("default", "123", "free");
    expect(getRuntimeGroupAckReaction("default", "123")).toBe(false);
  });

  it("rejects values that are not on/off/clear", () => {
    expect(() => setRuntimeGroupAckReaction("default", "123", "yes" as never)).toThrow(/invalid ack reaction/);
    expect(() => setRuntimeGroupAckReaction("default", "", true)).toThrow(/groupId required/);
  });

  it("is exposed on the bridge (v7) for the control plugin", async () => {
    const bridge = createBridgeService();
    expect(bridge.version).toBe(7);
    expect(await bridge.setGroupAckReaction!("default", "456", true)).toBe(true);
    expect(await bridge.getGroupAckReaction!("default", "456")).toBe(true);
    expect(await bridge.setGroupAckReaction!("default", "456", null)).toBeNull();
    expect(await bridge.getGroupAckReaction!("default", "456")).toBeNull();
  });

  it("the channel monitor consults the group override before sending the ack", () => {
    const src = readFileSync(new URL("../src/channel/monitor.ts", import.meta.url), "utf8");
    expect(src).toMatch(/groupOverride: isGroup \? getRuntimeGroupAckReaction\(account\.accountId, chatId\) : undefined/);
    expect(src).toMatch(/const shouldAck = Boolean\(ackReaction\);/);
  });
});
