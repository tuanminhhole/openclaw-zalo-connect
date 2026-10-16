/**
 * Câu hỏi `ask_user` đang chờ trả lời, theo từng hội thoại.
 *
 * Ghi nhận trên vps_thuy-le 16/10/2026: bot hỏi chủ "chọn kiểu ảnh nào" bằng `ask_user`, chủ trả lời
 * "1" trên Zalo nhưng bot treo cho tới khi có người bấm chọn trong Control UI. Nguyên nhân: hàng đợi
 * theo hội thoại (thread-queue) xử lý TUẦN TỰ - lượt đang chạy treo ở ask_user để chờ câu trả lời,
 * còn câu trả lời lại xếp hàng sau chính lượt đó. OpenClaw tự nhận chữ trả lời cho câu hỏi đang chờ
 * (agent runner, "plain-text claim"), nhưng chỉ khi tin tới được tới đó.
 *
 * Cách sửa: lúc gửi một payload mang `channelData.askUser.questionId` thì đánh dấu hội thoại. Tin kế
 * tiếp của hội thoại đó đi thẳng vào OpenClaw, không chờ hàng đợi. Không khớp câu hỏi thì OpenClaw
 * vẫn tự xếp nó sau lượt hiện tại như mọi tin khác, nên không mất tin nào.
 */

/** Câu hỏi ask_user sống tối đa 1 giờ (ASK_USER_TIMEOUT_SECONDS trong OpenClaw). */
export const PENDING_QUESTION_TTL_MS = 60 * 60 * 1000;

type PendingQuestion = { questionId: string; expiresAt: number };

const pending = new Map<string, PendingQuestion>();

function keyOf(accountId: string | undefined, threadId: string): string {
  return `${accountId || "default"}:${threadId}`;
}

/** Đọc questionId từ payload trả lời (cùng khoá với readAskUserQuestionId của OpenClaw). */
export function readAskUserQuestionIdFromPayload(payload: unknown): string | undefined {
  const askUser = (payload as { channelData?: { askUser?: unknown } } | null)?.channelData?.askUser;
  if (!askUser || typeof askUser !== "object" || Array.isArray(askUser)) return undefined;
  const id = (askUser as { questionId?: unknown }).questionId;
  return typeof id === "string" && id ? id : undefined;
}

export function markPendingQuestion(accountId: string | undefined, threadId: string, questionId: string, now = Date.now()): void {
  pending.set(keyOf(accountId, threadId), { questionId, expiresAt: now + PENDING_QUESTION_TTL_MS });
}

/** Lấy và xoá dấu câu hỏi đang chờ của hội thoại. Trả true khi có dấu còn hạn. */
export function takePendingQuestion(accountId: string | undefined, threadId: string, now = Date.now()): boolean {
  const key = keyOf(accountId, threadId);
  const entry = pending.get(key);
  if (!entry) return false;
  pending.delete(key);
  return entry.expiresAt > now;
}

export function clearPendingQuestion(accountId: string | undefined, threadId: string): void {
  pending.delete(keyOf(accountId, threadId));
}

/** Chỉ dùng trong test. */
export function _resetPendingQuestions(): void {
  pending.clear();
}

/**
 * Đưa một tin vào xử lý: hội thoại có câu hỏi đang chờ thì chạy ngay (bỏ qua hàng đợi), còn lại xếp hàng.
 */
export function routeInboundMessage<T>(params: {
  accountId: string | undefined;
  threadId: string;
  data: T;
  enqueue: (threadId: string, data: T) => void;
  runNow: (data: T) => Promise<void>;
  onError?: (err: unknown) => void;
}): "now" | "queued" {
  if (takePendingQuestion(params.accountId, params.threadId)) {
    params.runNow(params.data).catch((err) => params.onError?.(err));
    return "now";
  }
  params.enqueue(params.threadId, params.data);
  return "queued";
}
