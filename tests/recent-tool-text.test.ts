import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordToolSentText,
  wasRecentlyToolSent,
  _clearRecentToolText,
} from "../src/features/recent-tool-text.js";

describe("recent-tool-text (double file+reply dedupe)", () => {
  beforeEach(() => _clearRecentToolText());

  it("matches an exact caption sent to the same thread", () => {
    recordToolSentText("t1", "Đã lập lá số và xuất PDF.");
    expect(wasRecentlyToolSent("t1", "Đã lập lá số và xuất PDF.")).toBe(true);
  });

  it("normalizes whitespace when matching", () => {
    recordToolSentText("t1", "Đã lập  lá số\n và xuất PDF.");
    expect(wasRecentlyToolSent("t1", "Đã lập lá số và xuất PDF.")).toBe(true);
  });

  it("does not match a different reply text (no false suppression)", () => {
    recordToolSentText("t1", "File đây nhé");
    expect(wasRecentlyToolSent("t1", "Đã xong, sếp xem file giúp em")).toBe(false);
  });

  it("is scoped per thread", () => {
    recordToolSentText("t1", "báo cáo");
    expect(wasRecentlyToolSent("t2", "báo cáo")).toBe(false);
  });

  it("ignores empty/blank captions", () => {
    recordToolSentText("t1", "   ");
    expect(wasRecentlyToolSent("t1", "   ")).toBe(false);
  });

  it("expires after the TTL (90s)", () => {
    vi.useFakeTimers();
    try {
      recordToolSentText("t1", "hết hạn");
      expect(wasRecentlyToolSent("t1", "hết hạn")).toBe(true);
      vi.advanceTimersByTime(91_000);
      expect(wasRecentlyToolSent("t1", "hết hạn")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
