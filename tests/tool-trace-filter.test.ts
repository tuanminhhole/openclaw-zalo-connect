import { describe, it, expect } from "vitest";
import { _isToolTraceMessage as isToolTraceMessage, _sanitizeOverflowNotice as sanitizeOverflowNotice } from "../src/channel/monitor.js";

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

  it("detects the leaked message-send failure notice", () => {
    // Real leak: an ✉️ status line with an internal path + "reply to <id> failed".
    expect(isToolTraceMessage("@Kent ⚠️ ✉️ Message: media $OPENCLAW_HOME/media/outbound/openclaw-test-2026-07-25.pdf, reply to 8080124915950 failed")).toBe(true);
    expect(isToolTraceMessage("✉️ Message: media /home/node/project/.openclaw/media/outbound/x.pdf failed")).toBe(true);
    expect(isToolTraceMessage("Send failed, reply to 8080124915950 failed")).toBe(true);
  });

  it("flags any message that leaks an internal runtime path", () => {
    expect(isToolTraceMessage("Xong rồi: $OPENCLAW_HOME/media/outbound/a.pdf")).toBe(true);
    expect(isToolTraceMessage("saved to /home/node/project/.openclaw/media/inbound/b.jpg")).toBe(true);
  });

  it("does not flag a normal reply that talks about sending or files", () => {
    expect(isToolTraceMessage("Em gửi file PDF cho sếp không được, sếp thử lại nha 🦞")).toBe(false);
    expect(isToolTraceMessage("Đã gửi tin nhắn tới nhóm Test4 rồi sếp 🦞")).toBe(false);
    expect(isToolTraceMessage("File bát tự của anh Trần Tiến Nhân đây ạ 🦞")).toBe(false);
  });

  it("does not flag a reply that merely mentions the word agent", () => {
    expect(isToolTraceMessage("Em là AI agent hỗ trợ sếp nha 🦞")).toBe(false);
  });
});

describe("sanitizeOverflowNotice (strip operator config advice from overflow notices)", () => {
  it("strips the reserveTokensFloor advice line from an overflow notice", () => {
    const raw = "⚠️ Auto-compaction could not recover this turn. Please try again, use /compact, or use /new to start a fresh session.\n\nTo prevent this, increase your compaction buffer by setting agents.defaults.compaction.reserveTokensFloor to 50000 or higher in your config.";
    const out = sanitizeOverflowNotice(raw);
    expect(out).not.toMatch(/reserveTokensFloor|agents\.defaults\./);
    expect(out).toMatch(/use \/new to start a fresh session/);
  });

  it("leaves a normal reply that legitimately mentions openclaw.json untouched", () => {
    const help = "Sếp thêm dòng này vào agents.defaults.compaction trong openclaw.json rồi restart nhé 🦞";
    expect(sanitizeOverflowNotice(help)).toBe(help);
  });
});
