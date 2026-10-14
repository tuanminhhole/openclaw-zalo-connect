import { describe, expect, it } from "vitest";
import { stripProviderErrorText } from "../src/safety/output-filter.js";

// vps_minh-thu 12/10/2026: 9router nối "[Error] Our servers are currently overloaded..." vào cuối
// câu trả lời khi Codex báo lỗi giữa chừng, và tin đó đi thẳng ra nhóm Zalo của khách.
describe("stripProviderErrorText", () => {
  it("cắt đuôi [Error] do 9router nối vào câu trả lời", () => {
    const r = stripProviderErrorText("Dạ đúng cô, banner đã gửi thành công vào nhóm. Em đã đánh[Error] Our servers are currently overloaded. Please try again later.");
    expect(r.text).toBe("Dạ đúng cô, banner đã gửi thành công vào nhóm. Em đã đánh");
    expect(r.stripped).toBe("[Error] Our servers are currently overloaded. Please try again later.");
  });
  it("tin chỉ có lỗi: còn lại chuỗi rỗng", () => {
    expect(stripProviderErrorText("[Error] Rate limit exceeded\n").text).toBe("");
  });
  it("không đụng tới [Error] nằm giữa tin (bot trích log)", () => {
    const t = "Log báo: [Error] timeout\nEm đã thử lại và chạy được rồi ạ.";
    expect(stripProviderErrorText(t)).toEqual({ text: t, stripped: null });
  });
  it("tin bình thường giữ nguyên", () => {
    expect(stripProviderErrorText("Chào cả nhà")).toEqual({ text: "Chào cả nhà", stripped: null });
  });
});
