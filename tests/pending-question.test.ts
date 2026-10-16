import { describe, it, expect, beforeEach } from "vitest";
import {
  PENDING_QUESTION_TTL_MS,
  _resetPendingQuestions,
  clearPendingQuestion,
  markPendingQuestion,
  readAskUserQuestionIdFromPayload,
  routeInboundMessage,
  takePendingQuestion,
} from "../src/channel/pending-question.js";
import { ThreadMessageQueue } from "../src/channel/thread-queue.js";

// vps_thuy-le 16/10/2026: bot hỏi bằng ask_user, chủ trả lời "1" trên Zalo, bot treo vì câu trả lời
// xếp hàng sau chính lượt đang chờ nó.

describe("pending ask_user question", () => {
  beforeEach(() => _resetPendingQuestions());

  it("reads the question id from the ask_user payload", () => {
    expect(readAskUserQuestionIdFromPayload({ text: "Question for you", channelData: { askUser: { questionId: "q-1", optionValues: ["a", "b"] } } })).toBe("q-1");
    expect(readAskUserQuestionIdFromPayload({ text: "bình thường" })).toBeUndefined();
    expect(readAskUserQuestionIdFromPayload({ channelData: { askUser: { questionId: "" } } })).toBeUndefined();
    expect(readAskUserQuestionIdFromPayload({ channelData: { askUser: ["q-1"] } })).toBeUndefined();
    expect(readAskUserQuestionIdFromPayload(null)).toBeUndefined();
  });

  it("is consumed once, kept apart per account and thread, and expires", () => {
    markPendingQuestion("default", "u-1", "q-1", 1000);
    expect(takePendingQuestion("other", "u-1", 1001)).toBe(false);
    expect(takePendingQuestion("default", "u-2", 1001)).toBe(false);
    expect(takePendingQuestion("default", "u-1", 1001)).toBe(true);
    expect(takePendingQuestion("default", "u-1", 1002)).toBe(false);

    markPendingQuestion("default", "u-1", "q-2", 1000);
    expect(takePendingQuestion("default", "u-1", 1000 + PENDING_QUESTION_TTL_MS + 1)).toBe(false);

    markPendingQuestion("default", "u-1", "q-3", 1000);
    clearPendingQuestion("default", "u-1");
    expect(takePendingQuestion("default", "u-1", 1001)).toBe(false);
  });

  it("queues normally when no question is pending", () => {
    const queued: string[] = [];
    const ran: string[] = [];
    const route = routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "chào",
      enqueue: (_t, d) => queued.push(d), runNow: async (d) => { ran.push(d); },
    });
    expect(route).toBe("queued");
    expect(queued).toEqual(["chào"]);
    expect(ran).toEqual([]);
  });

  it("delivers the answer while the asking turn is still running", async () => {
    let releaseAskingTurn!: () => void;
    const askingTurnDone = new Promise<void>((r) => { releaseAskingTurn = r; });
    const handled: string[] = [];
    const queue = new ThreadMessageQueue<string>({
      maxConcurrent: 4,
      handler: async (msg) => {
        handled.push(msg);
        if (msg === "em thử tạo chị xem") {
          // Lượt này gửi câu hỏi ask_user rồi chờ câu trả lời.
          markPendingQuestion("default", "u-1", "q-1");
          await askingTurnDone;
        }
      },
    });
    const runNow = async (msg: string) => {
      handled.push(msg);
      if (msg === "1") releaseAskingTurn(); // OpenClaw nhận "1" làm câu trả lời, lượt kia chạy tiếp
    };
    const route = (msg: string) => routeInboundMessage({
      accountId: "default", threadId: "u-1", data: msg,
      enqueue: (t, d) => queue.enqueue(t, d), runNow,
    });

    route("em thử tạo chị xem");
    await new Promise((r) => setTimeout(r, 10));
    expect(route("1")).toBe("now");
    await askingTurnDone;
    expect(handled).toEqual(["em thử tạo chị xem", "1"]);

    // Câu hỏi đã dùng xong: tin sau lại đi hàng đợi như thường.
    expect(route("cảm ơn em")).toBe("queued");
  });

  it("reports errors of an immediate run instead of throwing", async () => {
    markPendingQuestion("default", "u-1", "q-1");
    const errors: unknown[] = [];
    routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "1",
      enqueue: () => {}, runNow: async () => { throw new Error("boom"); }, onError: (e) => errors.push(e),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(String(errors[0])).toContain("boom");
  });
});
