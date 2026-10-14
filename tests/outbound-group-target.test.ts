import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseOutboundTarget,
  recordGroupId,
  resetGroupIdCacheForTest,
  resolveOutboundIsGroup,
} from "../src/features/group-id-cache.js";

// vps_minh-thu 12/10/2026: ảnh gửi qua tool `message` ngay sau khi gateway khởi động lại đi lạc
// thành tin 1:1, vì cache nhóm còn trống và mã nhóm bị coi là mã người dùng.
describe("outbound group target", () => {
  beforeEach(() => resetGroupIdCacheForTest());

  it("đọc tiền tố group:/user: và bỏ tiền tố trước khi gửi", () => {
    expect(parseOutboundTarget("group:3517127512105728671")).toEqual({ id: "3517127512105728671", isGroup: true });
    expect(parseOutboundTarget("zalo-connect:group:123")).toEqual({ id: "123", isGroup: true });
    expect(parseOutboundTarget("user:456")).toEqual({ id: "456", isGroup: false });
    expect(parseOutboundTarget(" 789 ")).toEqual({ id: "789" });
  });

  it("mã nhóm chưa có trong cache: hỏi Zalo và gửi đúng kiểu nhóm", async () => {
    const lookup = vi.fn(async () => true);
    expect(await resolveOutboundIsGroup({ id: "3517127512105728671" }, lookup)).toBe(true);
    expect(await resolveOutboundIsGroup({ id: "3517127512105728671" }, lookup)).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("mã người dùng: hỏi một lần rồi nhớ là không phải nhóm", async () => {
    const lookup = vi.fn(async () => false);
    expect(await resolveOutboundIsGroup({ id: "2439789427344457611" }, lookup)).toBe(false);
    expect(await resolveOutboundIsGroup({ id: "2439789427344457611" }, lookup)).toBe(false);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("nhóm đã thấy trong phiên chạy thì không cần hỏi Zalo", async () => {
    recordGroupId("111");
    const lookup = vi.fn(async () => false);
    expect(await resolveOutboundIsGroup({ id: "111" }, lookup)).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("tiền tố rõ ràng thắng mọi thứ khác", async () => {
    const lookup = vi.fn(async () => false);
    expect(await resolveOutboundIsGroup({ id: "222", isGroup: true }, lookup)).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("Zalo không trả lời được: giữ hành vi cũ (người dùng) và không nhớ sai", async () => {
    const lookup = vi.fn(async () => { throw new Error("network"); });
    expect(await resolveOutboundIsGroup({ id: "333" }, lookup)).toBe(false);
    const ok = vi.fn(async () => true);
    expect(await resolveOutboundIsGroup({ id: "333" }, ok)).toBe(true);
  });
});

import { pickSentMessageIds } from "../src/channel/send.js";

// vps_minh-thu 12/10/2026: ảnh không kèm chữ vào nhóm thành công nhưng tool báo
// adapter_returned_no_identity, vì zca-js trả message=null và mã tin nằm ở attachment[0].
describe("pickSentMessageIds", () => {
  it("ảnh không kèm chữ: lấy mã tin từ attachment[0]", () => {
    expect(pickSentMessageIds({ message: null, attachment: [{ msgId: 7001, cliMsgId: "c1" }] })).toEqual({ msgId: 7001, cliMsgId: "c1" });
  });
  it("tin có chữ: vẫn ưu tiên message", () => {
    expect(pickSentMessageIds({ message: { msgId: 1, cliMsgId: 2 }, attachment: [{ msgId: 3 }] })).toEqual({ msgId: 1, cliMsgId: 2 });
  });
  it("không có gì: trả rỗng, không ném lỗi", () => {
    expect(pickSentMessageIds(undefined)).toEqual({ msgId: undefined, cliMsgId: undefined });
    expect(pickSentMessageIds({ message: null, attachment: [] })).toEqual({ msgId: undefined, cliMsgId: undefined });
  });
});
