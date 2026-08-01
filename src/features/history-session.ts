/**
 * Nhớ xem trang ĐẦU của lịch sử chat đã được xin trong phiên WebSocket này chưa.
 *
 * Luật của Zalo (đã đo trên tài khoản thật): `requestOldMessages(type, null)` gửi
 * `{ first: true, lastId: null }` và server chỉ trả về **một lần cho mỗi phiên kết nối**. Gọi lại
 * y hệt trong cùng phiên thì **không có phản hồi nào** — không lỗi, không sự kiện, im lặng hoàn
 * toàn.
 *
 * Đó là kiểu im lặng nguy hiểm nhất: người dùng bấm "lấy lịch sử" lần hai, không thấy gì xảy ra, và
 * kết luận tính năng hỏng. Nên phải nhớ lại để nói đúng chuyện gì đang diễn ra, thay vì trả
 * `success: true` cho một yêu cầu chắc chắn không có hồi âm.
 *
 * Muốn lùi xa hơn trang đầu thì truyền `lastMsgId` — đó là yêu cầu khác, luôn được trả lời.
 */

const requested = new Set<string>();

function key(accountId: string, threadType: "user" | "group"): string {
  return `${accountId || "default"}:${threadType}`;
}

export function markHistoryRequested(accountId: string, threadType: "user" | "group"): void {
  requested.add(key(accountId, threadType));
}

export function wasHistoryRequested(accountId: string, threadType: "user" | "group"): boolean {
  return requested.has(key(accountId, threadType));
}

/**
 * Xoá dấu khi phiên WebSocket dựng lại — phiên mới thì Zalo lại trả trang đầu.
 * Gọi từ chỗ listener kết nối, KHÔNG phải lúc plugin khởi động: mất mạng rồi tự nối lại cũng là
 * phiên mới.
 */
export function resetHistorySession(accountId: string): void {
  for (const k of [...requested]) {
    if (k.startsWith(`${accountId || "default"}:`)) requested.delete(k);
  }
}

/** Chỉ dùng cho test. */
export function clearAllHistorySessions(): void {
  requested.clear();
}
