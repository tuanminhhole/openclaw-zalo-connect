import { describe, it, expect, beforeEach } from "vitest";
import {
  PENDING_QUESTION_TTL_MS,
  _resetPendingQuestions,
  clearPendingQuestion,
  markPendingQuestion,
  matchQuestionAnswer,
  peekPendingQuestion,
  readAskUserOptionValuesFromPayload,
  readAskUserQuestionIdFromPayload,
  routeInboundMessage,
  takePendingQuestion,
} from "../src/channel/pending-question.js";
import { ThreadMessageQueue } from "../src/channel/thread-queue.js";

// vps_thuy-le 16/10/2026: bot hỏi bằng ask_user, chủ trả lời "1" trên Zalo, bot treo vì câu trả lời
// xếp hàng sau chính lượt đang chờ nó.

describe("pending ask_user question", () => {
  beforeEach(() => _resetPendingQuestions());

  it("reads the question id and option labels from the ask_user payload", () => {
    const payload = { text: "Question for you", channelData: { askUser: { questionId: "q-1", optionValues: ["Góp ý thiết kế", "Viết caption", ""] } } };
    expect(readAskUserQuestionIdFromPayload(payload)).toBe("q-1");
    expect(readAskUserOptionValuesFromPayload(payload)).toEqual(["Góp ý thiết kế", "Viết caption"]);
    expect(readAskUserQuestionIdFromPayload({ text: "bình thường" })).toBeUndefined();
    expect(readAskUserQuestionIdFromPayload({ channelData: { askUser: { questionId: "" } } })).toBeUndefined();
    expect(readAskUserQuestionIdFromPayload({ channelData: { askUser: ["q-1"] } })).toBeUndefined();
    expect(readAskUserQuestionIdFromPayload(null)).toBeUndefined();
    expect(readAskUserOptionValuesFromPayload({ channelData: { askUser: { questionId: "q" } } })).toEqual([]);
  });

  it("is consumed once, kept apart per account and thread, and expires", () => {
    markPendingQuestion("default", "u-1", "q-1", [], 1000);
    expect(takePendingQuestion("other", "u-1", 1001)).toBe(false);
    expect(takePendingQuestion("default", "u-2", 1001)).toBe(false);
    expect(takePendingQuestion("default", "u-1", 1001)).toBe(true);
    expect(takePendingQuestion("default", "u-1", 1002)).toBe(false);

    markPendingQuestion("default", "u-1", "q-2", [], 1000);
    expect(takePendingQuestion("default", "u-1", 1000 + PENDING_QUESTION_TTL_MS + 1)).toBe(false);

    markPendingQuestion("default", "u-1", "q-3", [], 1000);
    clearPendingQuestion("default", "u-1");
    expect(takePendingQuestion("default", "u-1", 1001)).toBe(false);
  });

  it("matches a typed number or an exact option label, nothing looser", () => {
    const opts = ["Góp ý thiết kế", "Viết caption", "Ý tưởng banner", "Kiểm tra chữ"];
    expect(matchQuestionAnswer("3", opts)).toEqual({ optionIndex: 2 });
    expect(matchQuestionAnswer(" 1. ", opts)).toEqual({ optionIndex: 0 });
    expect(matchQuestionAnswer("số 4", opts)).toEqual({ optionIndex: 3 });
    expect(matchQuestionAnswer("ý tưởng BANNER", opts)).toEqual({ optionValue: "Ý tưởng banner" });
    expect(matchQuestionAnswer("5", opts)).toBeNull();
    expect(matchQuestionAnswer("0", opts)).toBeNull();
    expect(matchQuestionAnswer("chọn cái banner đi", opts)).toBeNull();
    expect(matchQuestionAnswer("2", [])).toEqual({ optionIndex: 1 }); // >4 lựa chọn: Gateway tự đối chiếu chỉ số
    expect(matchQuestionAnswer("", opts)).toBeNull();
  });

  it("queues normally when no question is pending", async () => {
    const queued: string[] = [];
    const ran: string[] = [];
    const route = await routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "chào", text: "chào",
      enqueue: (_t, d) => queued.push(d), runNow: async (d) => { ran.push(d); },
      resolveQuestion: async () => ({ status: "answered" }),
    });
    expect(route).toBe("queued");
    expect(queued).toEqual(["chào"]);
    expect(ran).toEqual([]);
  });

  it("answers the question over the Gateway and keeps the reply out of the agent", async () => {
    markPendingQuestion("default", "u-1", "q-1", ["Góp ý thiết kế", "Viết caption", "Ý tưởng banner", "Kiểm tra chữ"]);
    const resolved: Array<[string, unknown]> = [];
    const answered: string[] = [];
    const ran: string[] = [];
    const queued: string[] = [];
    const route = await routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "3", text: "3",
      enqueue: (_t, d) => queued.push(d), runNow: async (d) => { ran.push(d); },
      resolveQuestion: async (id, match) => { resolved.push([id, match]); return { status: "answered" }; },
      onAnswered: (d) => { answered.push(d); },
    });
    expect(route).toBe("answered");
    expect(resolved).toEqual([["q-1", { optionIndex: 2 }]]);
    expect(answered).toEqual(["3"]); // vẫn ghi vào khung chat
    expect(ran).toEqual([]);          // không thành lượt bot mới => không có tin thừa
    expect(queued).toEqual([]);
    expect(peekPendingQuestion("default", "u-1")).toBeUndefined();
  });

  it("falls back to running the message now when the reply is free text or the Gateway refuses", async () => {
    const ran: string[] = [];
    markPendingQuestion("default", "u-1", "q-1", ["A", "B"]);
    expect(await routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "để anh nghĩ", text: "để anh nghĩ",
      enqueue: () => {}, runNow: async (d) => { ran.push(d); },
      resolveQuestion: async () => ({ status: "answered" }),
    })).toBe("now");

    markPendingQuestion("default", "u-1", "q-2", ["A", "B"]);
    expect(await routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "1", text: "1",
      enqueue: () => {}, runNow: async (d) => { ran.push(d); },
      resolveQuestion: async () => ({ status: "already-terminal" }),
    })).toBe("now");

    markPendingQuestion("default", "u-1", "q-3", ["A", "B"]);
    const errors: unknown[] = [];
    expect(await routeInboundMessage({
      accountId: "default", threadId: "u-1", data: "2", text: "2",
      enqueue: () => {}, runNow: async (d) => { ran.push(d); },
      resolveQuestion: async () => { throw new Error("gateway down"); }, onError: (e) => errors.push(e),
    })).toBe("now");
    expect(ran).toEqual(["để anh nghĩ", "1", "2"]);
    expect(String(errors[0])).toContain("gateway down");
  });

  it("does not wait behind the asking turn when it has to fall back", async () => {
    let releaseAskingTurn!: () => void;
    const askingTurnDone = new Promise<void>((r) => { releaseAskingTurn = r; });
    const handled: string[] = [];
    const queue = new ThreadMessageQueue<string>({
      maxConcurrent: 4,
      handler: async (msg) => {
        handled.push(msg);
        if (msg === "em thử tạo chị xem") {
          markPendingQuestion("default", "u-1", "q-1");
          await askingTurnDone;
        }
      },
    });
    const runNow = async (msg: string) => { handled.push(msg); releaseAskingTurn(); };
    const route = (msg: string) => routeInboundMessage({
      accountId: "default", threadId: "u-1", data: msg, text: msg,
      enqueue: (t, d) => queue.enqueue(t, d), runNow,
    });

    await route("em thử tạo chị xem");
    await new Promise((r) => setTimeout(r, 10));
    expect(await route("chị chọn cái đầu")).toBe("now");
    await askingTurnDone;
    expect(handled).toEqual(["em thử tạo chị xem", "chị chọn cái đầu"]);
    expect(await route("cảm ơn em")).toBe("queued");
  });
});

describe("outbound sendPayload carries ask_user questions", () => {
  // OpenClaw gửi payload có channelData/presentation qua outbound.sendPayload; thiếu hàm này thì
  // sendText chỉ nhận chữ và channelData.askUser rơi mất (đo trên vps_thuy-le 16/10/2026).
  it("the channel declares sendPayload next to sendText", async () => {
    const { zaloConnectPlugin } = await import("../src/channel/channel.js");
    expect(typeof (zaloConnectPlugin.outbound as any)?.sendPayload).toBe("function");
    expect(typeof (zaloConnectPlugin.outbound as any)?.sendText).toBe("function");
  });

  it("sendPayload marks the question for a direct chat before sending", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/channel/channel.ts", import.meta.url), "utf8");
    const block = src.slice(src.indexOf("sendPayload: async"), src.indexOf("sendMedia: async"));
    expect(block).toMatch(/readAskUserQuestionIdFromPayload\(payload\)/);
    expect(block).toMatch(/if \(questionId && !isGroup\) markPendingQuestion\(account\.accountId, to, questionId, readAskUserOptionValuesFromPayload\(payload\)\)/);
    expect(block.indexOf("markPendingQuestion")).toBeLessThan(block.indexOf("sendMessageZaloConnect"));
  });
});
