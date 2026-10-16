import { describe, it, expect } from "vitest";
import { ThreadType } from "zca-js";
import {
  _buildBridgeAttachments as buildBridgeAttachments,
  _convertToZaloConnectMessage as convertToZaloConnectMessage,
} from "../src/channel/monitor.js";
import {
  createBridgeService,
  publishBridgeInbound,
  type ZaloConnectBridgeInboundEvent,
} from "../src/runtime/bridge.js";

// Ghi nhận trên vps_thuy-le 16/10/2026: chủ bot gửi ảnh vào DM, bot vẫn thấy ảnh (OpenClaw tải về),
// nhưng khung chat zalo-mod chỉ lưu chữ. Sự kiện inbound của bridge không mang ảnh/tệp nào.

function fakeUserMessage(content: unknown) {
  return {
    type: ThreadType.User,
    threadId: "2217625920592607252",
    isSelf: false,
    data: {
      content,
      uidFrom: "2217625920592607252",
      dName: "Thủy Lê",
      ts: "1792143124865",
      msgId: `msg-${Math.random()}`,
      cliMsgId: `cli-${Math.random()}`,
    },
  } as any;
}

describe("bridge inbound attachments", () => {
  it("turns a photo with caption into an image attachment", () => {
    const converted = convertToZaloConnectMessage(fakeUserMessage({
      title: "hình ảnh này là chủ đề hôm nay",
      hdUrl: "https://f20-zpc.zdn.vn/hd/gau-bac-cuc.jpg",
      thumb: "https://f20-zpc.zdn.vn/thumb/gau-bac-cuc.jpg",
    }));

    expect(buildBridgeAttachments(converted?.mediaUrls, converted?.mediaTypes)).toEqual([
      { kind: "image", url: "https://f20-zpc.zdn.vn/hd/gau-bac-cuc.jpg", mime: "image/jpeg" },
    ]);
  });

  it("turns a shared PDF into a file attachment with its mime", () => {
    const converted = convertToZaloConnectMessage(fakeUserMessage(JSON.stringify({
      title: "bao-gia.pdf",
      href: "https://f5-zpg.zdn.vn/file/d/abc123",
      params: JSON.stringify({ fileExt: "pdf", fileName: "bao-gia.pdf", fileSize: 1024 }),
    })));

    expect(buildBridgeAttachments(converted?.mediaUrls, converted?.mediaTypes)).toEqual([
      { kind: "file", url: "https://f5-zpg.zdn.vn/file/d/abc123", mime: "application/pdf" },
    ]);
  });

  it("returns undefined for a plain text message and for a link card", () => {
    const text = convertToZaloConnectMessage(fakeUserMessage("chào em"));
    const link = convertToZaloConnectMessage(fakeUserMessage({
      title: "Truy cập link để tham gia cộng đồng",
      href: "https://zalo.me/g/5x7e2ahy36eonbotvxk2",
    }));

    expect(buildBridgeAttachments(text?.mediaUrls, text?.mediaTypes)).toBeUndefined();
    expect(buildBridgeAttachments(link?.mediaUrls, link?.mediaTypes)).toBeUndefined();
  });

  it("falls back to kind file without mime when the type is unknown", () => {
    expect(buildBridgeAttachments(["https://example.com/x"], undefined)).toEqual([
      { kind: "file", url: "https://example.com/x" },
    ]);
  });

  it("delivers attachments to inbound subscribers unchanged", async () => {
    const bridge = createBridgeService();
    const seen: ZaloConnectBridgeInboundEvent[] = [];
    const off = bridge.subscribeInbound((event) => { seen.push(event); });

    await publishBridgeInbound({
      accountId: "default",
      conversationId: "2217625920592607252",
      isGroup: false,
      messageId: "8381480068504",
      senderId: "2217625920592607252",
      senderName: "Thủy Lê",
      text: "hình ảnh này là chủ đề hôm nay",
      timestamp: 1792143124865,
      attachments: [{ kind: "image", url: "https://f20-zpc.zdn.vn/hd/gau-bac-cuc.jpg", mime: "image/jpeg" }],
    });
    off();

    // zalo-mod đọc đúng các khoá kind/url/mime này (src/integration/zalo-connect-bridge.js).
    expect(seen).toHaveLength(1);
    expect(seen[0].attachments).toEqual([
      { kind: "image", url: "https://f20-zpc.zdn.vn/hd/gau-bac-cuc.jpg", mime: "image/jpeg" },
    ]);
  });
});
