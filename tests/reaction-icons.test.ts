import { describe, it, expect } from "vitest";
import { Reactions } from "zca-js";
import { resolveReactionIcon, generateReactionHash } from "../src/features/reaction-icons.js";

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

  it("sends an emoji as a custom reaction carrying that exact glyph", () => {
    // Not the nearest built-in: Zalo's built-in artwork no longer matches the enum
    // names, so 👀 resolved to SURPRISE used to render as a kissing face.
    expect(resolveReactionIcon("👀")).toEqual({ rType: 1772451, source: 6, icon: "👀" });
    expect(resolveReactionIcon("😎")).toEqual({ rType: 1772913, source: 6, icon: "😎" });
  });

  it("uses the hash Zalo Web computes for the same emoji", () => {
    expect(generateReactionHash("👀")).toBe(1772451);
    expect(generateReactionHash("🔥")).toBe(1772680);
  });

  it("uses Zalo Web's fixed types for the two emoji it hardcodes", () => {
    expect(resolveReactionIcon("👏")).toEqual({ rType: 100, source: 6, icon: "👏" });
    expect(resolveReactionIcon("🎉")).toEqual({ rType: 101, source: 6, icon: "🎉" });
  });

  it("trims surrounding whitespace", () => {
    expect(resolveReactionIcon("  👀  ")).toEqual({ rType: 1772451, source: 6, icon: "👀" });
  });

  it("can send an emoji outside Zalo's built-in set", () => {
    // The custom-reaction path is not limited to Zalo's own 55 reactions.
    expect(resolveReactionIcon("🦞")).toEqual({ rType: 1772832, source: 6, icon: "🦞" });
  });

  it("returns undefined for an unknown ASCII token", () => {
    expect(resolveReactionIcon("definitely-not-a-reaction")).toBeUndefined();
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
