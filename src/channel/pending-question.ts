/**
 * Câu hỏi `ask_user` đang chờ trả lời, theo từng hội thoại.
 *
 * Ghi nhận trên vps_thuy-le 16/10/2026: bot hỏi chủ "chọn kiểu ảnh nào" bằng `ask_user`, chủ trả lời
 * "1" trên Zalo nhưng bot treo tới khi câu hỏi hết hạn (hoặc có người bấm chọn trong Control UI), rồi
 * mới xử lý "1" như một tin mới, nên bot nhắn thêm một câu thừa. Có HAI lớp xếp hàng chặn câu trả lời:
 * hàng đợi theo hội thoại của plugin (thread-queue, xử lý tuần tự) và hàng đợi phiên của OpenClaw
 * (phiên đang bận lượt hỏi thì tin sau chờ). Vượt được lớp đầu vẫn kẹt ở lớp sau.
 *
 * Cách sửa: làm như WhatsApp/Signal làm với reaction 1️⃣-4️⃣. Lúc gửi payload mang
 * `channelData.askUser` thì nhớ questionId + các lựa chọn. Tin kế tiếp của hội thoại là số thứ tự
 * hoặc đúng nhãn một lựa chọn thì trả lời câu hỏi thẳng qua Gateway (`resolveQuestionOverGateway`),
 * không đưa vào agent thành một lượt mới. Không khớp thì tin đi tiếp như thường.
 */

/** Câu hỏi ask_user sống tối đa 1 giờ (ASK_USER_TIMEOUT_SECONDS trong OpenClaw). */
export const PENDING_QUESTION_TTL_MS = 60 * 60 * 1000;

export type PendingQuestion = { questionId: string; optionValues: string[]; expiresAt: number };

const pending = new Map<string, PendingQuestion>();

function keyOf(accountId: string | undefined, threadId: string): string {
  return `${accountId || "default"}:${threadId}`;
}

function readAskUser(payload: unknown): Record<string, unknown> | undefined {
  const askUser = (payload as { channelData?: { askUser?: unknown } } | null)?.channelData?.askUser;
  if (!askUser || typeof askUser !== "object" || Array.isArray(askUser)) return undefined;
  return askUser as Record<string, unknown>;
}

/** Đọc questionId từ payload trả lời (cùng khoá với readAskUserQuestionId của OpenClaw). */
export function readAskUserQuestionIdFromPayload(payload: unknown): string | undefined {
  const id = readAskUser(payload)?.questionId;
  return typeof id === "string" && id ? id : undefined;
}

/** Nhãn các lựa chọn OpenClaw gửi kèm (chỉ có khi câu hỏi một lựa chọn, 2-4 phương án). */
export function readAskUserOptionValuesFromPayload(payload: unknown): string[] {
  const values = readAskUser(payload)?.optionValues;
  return Array.isArray(values) ? values.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

export function markPendingQuestion(
  accountId: string | undefined,
  threadId: string,
  questionId: string,
  optionValues: string[] = [],
  now = Date.now(),
): void {
  pending.set(keyOf(accountId, threadId), { questionId, optionValues, expiresAt: now + PENDING_QUESTION_TTL_MS });
}

/** Xem câu hỏi đang chờ của hội thoại (không xoá). Hết hạn thì xoá và trả undefined. */
export function peekPendingQuestion(accountId: string | undefined, threadId: string, now = Date.now()): PendingQuestion | undefined {
  const key = keyOf(accountId, threadId);
  const entry = pending.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    pending.delete(key);
    return undefined;
  }
  return entry;
}

/** Lấy và xoá dấu câu hỏi đang chờ của hội thoại. Trả true khi có dấu còn hạn. */
export function takePendingQuestion(accountId: string | undefined, threadId: string, now = Date.now()): boolean {
  const entry = peekPendingQuestion(accountId, threadId, now);
  pending.delete(keyOf(accountId, threadId));
  return Boolean(entry);
}

export function clearPendingQuestion(accountId: string | undefined, threadId: string): void {
  pending.delete(keyOf(accountId, threadId));
}

/** Chỉ dùng trong test. */
export function _resetPendingQuestions(): void {
  pending.clear();
}

export type QuestionAnswerMatch = { optionIndex: number } | { optionValue: string };

/**
 * Câu trả lời gõ tay có chỉ đúng một lựa chọn không. Nhận "3", "3.", "số 3", hoặc nguyên nhãn lựa
 * chọn (không phân biệt hoa thường). Câu khác thì trả null để tin đi đường thường - không đoán.
 */
export function matchQuestionAnswer(text: string, optionValues: string[]): QuestionAnswerMatch | null {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const num = /^(?:số\s*)?(\d{1,2})[.)]?$/i.exec(t);
  if (num) {
    const n = Number(num[1]);
    if (n < 1) return null;
    if (optionValues.length && n > optionValues.length) return null;
    return { optionIndex: n - 1 };
  }
  const lower = t.toLowerCase();
  const hit = optionValues.find((v) => v.trim().toLowerCase() === lower);
  return hit ? { optionValue: hit } : null;
}

export type ResolveQuestionResult = { status: string };

/**
 * Đưa một tin vào xử lý. Hội thoại có câu hỏi đang chờ:
 *  - tin khớp một lựa chọn và trả lời được qua Gateway => "answered", tin KHÔNG vào agent (`onAnswered`
 *    vẫn được gọi để ghi lại tin cho khung chat);
 *  - còn lại => chạy ngay, không xếp sau lượt đang chờ ("now").
 * Không có câu hỏi => xếp hàng như thường ("queued").
 */
export async function routeInboundMessage<T>(params: {
  accountId: string | undefined;
  threadId: string;
  data: T;
  text?: string;
  enqueue: (threadId: string, data: T) => void;
  runNow: (data: T) => Promise<void>;
  resolveQuestion?: (questionId: string, match: QuestionAnswerMatch) => Promise<ResolveQuestionResult | null>;
  onAnswered?: (data: T) => void | Promise<void>;
  onError?: (err: unknown) => void;
}): Promise<"answered" | "now" | "queued"> {
  const question = peekPendingQuestion(params.accountId, params.threadId);
  if (!question) {
    params.enqueue(params.threadId, params.data);
    return "queued";
  }
  const match = params.resolveQuestion ? matchQuestionAnswer(params.text ?? "", question.optionValues) : null;
  if (match && params.resolveQuestion) {
    try {
      const res = await params.resolveQuestion(question.questionId, match);
      if (res?.status === "answered") {
        clearPendingQuestion(params.accountId, params.threadId);
        try { await params.onAnswered?.(params.data); } catch (err) { params.onError?.(err); }
        return "answered";
      }
    } catch (err) {
      params.onError?.(err);
    }
  }
  clearPendingQuestion(params.accountId, params.threadId);
  params.runNow(params.data).catch((err) => params.onError?.(err));
  return "now";
}
