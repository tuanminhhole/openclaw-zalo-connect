import { afterEach, describe, expect, it, vi } from "vitest";

// vps_thuy-le 03/11/2026: OpenClaw 2026.9.8 evaluated this plugin more than once in one gateway.
// Zalo Mod wrote through the bridge of one copy while the monitor read the tables of another,
// so "no reaction" and silent mode never reached the monitor. vi.resetModules() gives a second,
// separate copy of the same module files, like the gateway does.

type ReactionModule = typeof import("../src/runtime/group-reaction.js");
type PolicyModule = typeof import("../src/runtime/group-policy.js");
type TriggerModule = typeof import("../src/runtime/name-triggers.js");

async function freshCopy() {
  vi.resetModules();
  const reaction = (await import("../src/runtime/group-reaction.js")) as ReactionModule;
  const policy = (await import("../src/runtime/group-policy.js")) as PolicyModule;
  const triggers = (await import("../src/runtime/name-triggers.js")) as TriggerModule;
  return { reaction, policy, triggers };
}

afterEach(async () => {
  const { reaction, policy, triggers } = await freshCopy();
  reaction.clearAllRuntimeGroupAckReactions();
  policy.clearAllRuntimeGroupPolicies();
  triggers.clearAllRuntimeNameTriggers();
});

describe("runtime tables are shared by every copy of the plugin", () => {
  it("a reaction choice written by one copy is seen by another", async () => {
    const writer = await freshCopy();
    const reader = await freshCopy();
    expect(writer.reaction).not.toBe(reader.reaction);

    writer.reaction.setRuntimeGroupAckReaction("default", "group:4319", false);
    expect(reader.reaction.getRuntimeGroupAckReaction("default", "4319")).toBe(false);
    expect(reader.reaction.resolveAckReactionForMessage({
      globalEmoji: "/-heart",
      globalShouldAck: true,
      groupOverride: reader.reaction.getRuntimeGroupAckReaction("default", "4319"),
    })).toBe("");
  });

  it("a silent mode written by one copy is seen by another", async () => {
    const writer = await freshCopy();
    const reader = await freshCopy();
    writer.policy.setRuntimeGroupPolicy("default", "4319", "silent");
    expect(reader.policy.getRuntimeGroupPolicy("default", "4319")?.requireMention).toBe(true);
  });

  it("name aliases written by one copy are seen by another", async () => {
    const writer = await freshCopy();
    const reader = await freshCopy();
    writer.triggers.setRuntimeNameTriggers("default", ["Mơ ơi"]);
    expect(reader.triggers.getRuntimeNameTriggers("default")).toEqual(["Mơ ơi"]);
  });
});
