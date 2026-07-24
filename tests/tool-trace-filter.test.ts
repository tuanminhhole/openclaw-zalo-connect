import { describe, it, expect } from "vitest";
import { _isToolTraceMessage as isToolTraceMessage } from "../src/channel/monitor.js";

describe("isToolTraceMessage (keep tool traces off the channel)", () => {
  it("detects the leaked exec-trace reply", () => {
    expect(isToolTraceMessage("⚠️ 🛠️ Exec failed: run python3 inline script (heredoc) → run file → list files (agent)")).toBe(true);
    expect(isToolTraceMessage("🛠️ run python3 → copy file → list files (agent)")).toBe(true);
    expect(isToolTraceMessage("@Kent ⚠️ 🛠️ Exec failed: run python3 (heredoc) (agent)")).toBe(true);
  });

  it("does NOT flag a normal reply", () => {
    expect(isToolTraceMessage("File PDF test đơn giản đây sếp 🦞")).toBe(false);
    expect(isToolTraceMessage("Đã gửi ảnh sang nhóm Test2 rồi sếp Kent 🦞")).toBe(false);
    expect(isToolTraceMessage("Dự án chính của sếp là Zenith Ops 🦞")).toBe(false);
    expect(isToolTraceMessage("")).toBe(false);
  });

  it("does not flag a reply that merely mentions the word agent", () => {
    expect(isToolTraceMessage("Em là AI agent hỗ trợ sếp nha 🦞")).toBe(false);
  });
});
