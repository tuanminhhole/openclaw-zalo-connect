/**
 * Tests for isLocalFilePath and send module.
 * [M1]
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/client/zalo-client.js", () => ({ getApi: vi.fn() }));

import { getApi } from "../src/client/zalo-client.js";
import { isLocalFilePath, sendMessageZaloConnect } from "../src/channel/send.js";

describe("isLocalFilePath", () => {
  // Should return true for local paths
  it("detects absolute paths", () => {
    expect(isLocalFilePath("/home/user/file.txt")).toBe(true);
    expect(isLocalFilePath("/tmp/image.jpg")).toBe(true);
  });

  it("detects relative paths with ./", () => {
    expect(isLocalFilePath("./image.jpg")).toBe(true);
  });

  it("detects relative paths with ../", () => {
    expect(isLocalFilePath("../image.jpg")).toBe(true);
  });

  // [M1] Should NOT match URLs — this was the bug
  it("does NOT match URLs containing workspace path substring", () => {
    expect(isLocalFilePath("https://evil.com/.openclaw/workspace/malicious")).toBe(false);
  });

  it("does NOT match http URLs", () => {
    expect(isLocalFilePath("https://example.com/image.jpg")).toBe(false);
    expect(isLocalFilePath("http://example.com/file.txt")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isLocalFilePath("")).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isLocalFilePath("hello world")).toBe(false);
    expect(isLocalFilePath("some random text")).toBe(false);
  });
});

describe("sendMessageZaloConnect exact native mentions", () => {
  it("uses the supplied UID mention without member-name lookup", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ message: { msgId: "out-1" } });
    vi.mocked(getApi).mockResolvedValue({ sendMessage } as any);

    const mentions = [{ uid: "uid-kent", pos: 0, len: 5 }];
    const result = await sendMessageZaloConnect("group-1", "@Kent chào bạn", {
      isGroup: true,
      mentions,
    });

    expect(result.ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "@Kent chào bạn", mentions }),
      "group-1",
      expect.anything(),
    );
  });
});
