/**
 * Tracks text the agent sent via the zalo-connect TOOL (e.g. `send-file` /
 * `send-image` caption). The native reply pipeline uses this to skip an identical
 * follow-up text the model ALSO wrote as its turn reply — which otherwise produces
 * a double message: the file/caption (no mention, sent by the tool) plus the same
 * text again (with mention, sent by the reply pipeline).
 *
 * Keyed per thread with a short TTL. Exact (whitespace-normalized) match only, so a
 * genuinely different reply is never suppressed.
 */
const recent = new Map<string, Array<{ text: string; ts: number }>>();
const TTL_MS = 90_000;
const MAX_PER_THREAD = 8;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function recordToolSentText(threadId: unknown, text: unknown): void {
  const t = threadId != null ? String(threadId).trim() : "";
  const body = typeof text === "string" ? normalize(text) : "";
  if (!t || !body) return;
  const cutoff = Date.now() - TTL_MS;
  const list = (recent.get(t) ?? []).filter((e) => e.ts > cutoff);
  list.push({ text: body, ts: Date.now() });
  recent.set(t, list.slice(-MAX_PER_THREAD));
}

export function wasRecentlyToolSent(threadId: unknown, text: unknown): boolean {
  const t = threadId != null ? String(threadId).trim() : "";
  const body = typeof text === "string" ? normalize(text) : "";
  if (!t || !body) return false;
  const list = recent.get(t);
  if (!list) return false;
  const cutoff = Date.now() - TTL_MS;
  return list.some((e) => e.ts > cutoff && e.text === body);
}

/** Exported for tests. */
export function _clearRecentToolText(): void {
  recent.clear();
}
