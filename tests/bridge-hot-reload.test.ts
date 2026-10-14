import { describe, expect, it, vi } from "vitest";

// vps_asa 14/10/2026: zalo-connect được cài lại khi gateway đang chạy ("Plugin replacement applied"),
// module mới có danh sách người nghe RỖNG, zalo-mod vẫn nghe ở danh sách cũ nên khung chat ngừng ghi tin.
describe("bridge subscriptions survive a hot plugin replacement", () => {
  const event = {
    accountId: "default",
    conversationId: "group:1",
    groupId: "1",
    isGroup: true,
    messageId: "m1",
    senderId: "u1",
    senderName: "Anh Sa",
    text: "xin chào",
    timestamp: 1,
  };

  it("tin phát từ bản nạp mới vẫn tới người đã đăng ký ở bản nạp cũ", async () => {
    vi.resetModules();
    const oldModule = await import("../src/runtime/bridge.js");
    const received: string[] = [];
    const unsubscribe = oldModule.exposeBridgeService().subscribeInbound((e) => { received.push(e.text); });

    vi.resetModules(); // OpenClaw nạp lại bundle của plugin
    const newModule = await import("../src/runtime/bridge.js");
    expect(newModule).not.toBe(oldModule);
    newModule.exposeBridgeService();
    await newModule.publishBridgeInbound(event);
    expect(received).toEqual(["xin chào"]);

    unsubscribe();
    await newModule.publishBridgeInbound(event);
    expect(received).toEqual(["xin chào"]);
  });

  it("lịch sử và trạng thái đang gõ cũng dùng chung", async () => {
    vi.resetModules();
    const a = await import("../src/runtime/bridge.js");
    const seen: string[] = [];
    const offH = a.exposeBridgeService().subscribeHistory(() => { seen.push("history"); });
    const offT = a.exposeBridgeService().subscribeTyping(() => { seen.push("typing"); });
    vi.resetModules();
    const b = await import("../src/runtime/bridge.js");
    expect(b.hasBridgeHistorySubscribers()).toBe(true);
    await b.publishBridgeHistory([{ ...event, fromSelf: false } as never]);
    await b.publishBridgeTyping({ accountId: "default", conversationId: "group:1", isGroup: true, senderId: "u1", at: 1 });
    expect(seen).toEqual(["history", "typing"]);
    offH();
    offT();
  });
});
