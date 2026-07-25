import { describe, it, expect } from "vitest";
import { Reactions } from "zca-js";
import { resolveReactionIcon } from "../src/features/reaction-icons.js";

describe("resolveReactionIcon", () => {
  it("passes a raw Zalo code straight through", () => {
    expect(resolveReactionIcon("b-)")).toBe(Reactions.SUNGLASSES);
    expect(resolveReactionIcon(":-*")).toBe(Reactions.KISS);
    expect(resolveReactionIcon("/-rose")).toBe(Reactions.ROSE);
  });

  it("resolves reaction names regardless of case or separator", () => {
    expect(resolveReactionIcon("sunglasses")).toBe(Reactions.SUNGLASSES);
    expect(resolveReactionIcon("SUNGLASSES")).toBe(Reactions.SUNGLASSES);
    expect(resolveReactionIcon("tears_of_joy")).toBe(Reactions.TEARS_OF_JOY);
    expect(resolveReactionIcon("tears-of-joy")).toBe(Reactions.TEARS_OF_JOY);
    expect(resolveReactionIcon("tearsofjoy")).toBe(Reactions.TEARS_OF_JOY);
  });

  it("maps emoji to the nearest Zalo reaction", () => {
    expect(resolveReactionIcon("😎")).toBe(Reactions.SUNGLASSES);
    expect(resolveReactionIcon("👍")).toBe(Reactions.LIKE);
    expect(resolveReactionIcon("🌹")).toBe(Reactions.ROSE);
    expect(resolveReactionIcon("👀")).toBe(Reactions.SURPRISE);
  });

  it("accepts hearts with or without the variation selector", () => {
    expect(resolveReactionIcon("❤️")).toBe(Reactions.HEART);
    expect(resolveReactionIcon("❤")).toBe(Reactions.HEART);
  });

  it("trims surrounding whitespace", () => {
    expect(resolveReactionIcon("  😎  ")).toBe(Reactions.SUNGLASSES);
  });

  it("returns undefined for emoji Zalo has no reaction for", () => {
    // The whole point of the resolver: 🦞 cannot be sent, and guessing would produce
    // an rType of -1 that Zalo rejects without the reaction ever appearing.
    expect(resolveReactionIcon("🦞")).toBeUndefined();
    expect(resolveReactionIcon("🐙")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(resolveReactionIcon("")).toBeUndefined();
    expect(resolveReactionIcon("   ")).toBeUndefined();
  });

  it("treats off/remove as clearing the reaction", () => {
    expect(resolveReactionIcon("off")).toBe(Reactions.NONE);
    expect(resolveReactionIcon("none")).toBe(Reactions.NONE);
  });

  it("resolves every reaction name the enum defines", () => {
    for (const name of Object.keys(Reactions)) {
      expect(resolveReactionIcon(name.toLowerCase()), name).toBeDefined();
    }
  });
});
