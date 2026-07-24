import { describe, it, expect } from "vitest";
import { textMentionsAnyName } from "../src/features/name-trigger.js";

describe("textMentionsAnyName (name-trigger gate)", () => {
  it("matches the bot display name as a word", () => {
    expect(textMentionsAnyName("William cho anh hỏi", ["William"])).toBe(true);
    expect(textMentionsAnyName("cc anh William nhé", ["William"])).toBe(true);
  });

  it("matches a short alias as a standalone word", () => {
    expect(textMentionsAnyName("mei ơi lấy giúp", ["Meimei", "mei"])).toBe(true);
    expect(textMentionsAnyName("mkt 789", ["mkt"])).toBe(true);
  });

  it("is accent- and case-insensitive", () => {
    expect(textMentionsAnyName("MÊI ơi", ["mei"])).toBe(true); // accent + case
    expect(textMentionsAnyName("Mèi giúp anh", ["mei"])).toBe(true);
  });

  it("does NOT match the alias inside an unrelated word", () => {
    expect(textMentionsAnyName("cái meiji này", ["mei"])).toBe(false);
    expect(textMentionsAnyName("khong lien quan", ["mkt"])).toBe(false);
  });

  it("ignores blank/too-short names and empty text", () => {
    expect(textMentionsAnyName("alo", ["", " ", "a"])).toBe(false);
    expect(textMentionsAnyName("", ["mei"])).toBe(false);
  });

  it("returns false when no name matches", () => {
    expect(textMentionsAnyName("chào cả nhà", ["William", "mei"])).toBe(false);
  });
});
