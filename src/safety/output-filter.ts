/**
 * Output redaction — prevent leaking internal paths, secrets, and stack traces.
 *
 * [M2] Lowered minimum secret length from 20 to 8 chars to catch short tokens.
 * [M3] Regex patterns are created fresh per call to avoid global state / lastIndex issues.
 */

type RedactionRule = { pattern: () => RegExp; replacement: string };

/**
 * Factory functions for regex patterns — avoids shared mutable state.
 * [M3] Each call creates a fresh RegExp instance, no lastIndex race condition.
 */
const REDACTION_RULES: RedactionRule[] = [
  { pattern: () => /\/root\/[^\s"'`)\]}>]+/g, replacement: "[path]" },
  { pattern: () => /\/home\/[^\s"'`)\]}>]+/g, replacement: "[path]" },
  { pattern: () => /~\/\.openclaw\/[^\s"'`)\]}>]+/g, replacement: "[path]" },
  { pattern: () => /\/usr\/lib\/node_modules\/[^\s"'`)\]}>]+/g, replacement: "[path]" },
  { pattern: () => /\bmcp__[a-z_-]+__[a-z_-]+/g, replacement: "[tool]" },
  { pattern: () => /openclaw\/plugin-sdk\/[^\s"'`)\]}>]+/g, replacement: "[internal]" },
  { pattern: () => /openclaw\/dist\/[^\s"'`)\]}>]+/g, replacement: "[internal]" },
  { pattern: () => /\bsession[_-]?id[:\s=]+[a-f0-9-]{36}/gi, replacement: "session [id]" },
  // [M2] Lowered from {20,} to {8,} to catch shorter secrets/tokens
  { pattern: () => /\b(api[_-]?key|token|secret|password|credential)[:\s=]+["']?[A-Za-z0-9_\-./+=]{8,}["']?/gi, replacement: "$1=[redacted]" },
  { pattern: () => /\bpm2\s+(restart|stop|start|delete|logs)\s+[^\s]+/g, replacement: "pm2 [command]" },
  { pattern: () => /at\s+[^\n]*node_modules[^\n]*/g, replacement: "at [internal]" },
  { pattern: () => /at\s+[^\n]*\/dist\/[^\n]*/g, replacement: "at [internal]" },
];

export function redactOutput(text: string): string {
  let result = text;
  for (const { pattern, replacement } of REDACTION_RULES) {
    result = result.replace(pattern(), replacement);
  }
  return result;
}

export function hasInternalInfo(text: string): boolean {
  return REDACTION_RULES.some(({ pattern }) => pattern().test(text));
}

/**
 * 9router turns an upstream `error` / `response.failed` event that arrives mid-stream into plain
 * answer text - `[Error] <message>` appended to whatever was already streamed - and closes the
 * turn with finish_reason "stop". OpenClaw then sees a normal answer, does not retry, and the
 * provider's error string lands in the customer's chat (vps_minh-thu, 12/10/2026:
 * "...Em đã đánh[Error] Our servers are currently overloaded. Please try again later.").
 * 9router always APPENDS it as the last chunk, so only a trailing `[Error] ...` is removed; the
 * same words in the middle of a message (a bot quoting a log) are left alone.
 */
const PROVIDER_ERROR_TAIL = /\[Error\] [^\n]*\s*$/;

export function stripProviderErrorText(text: string): { text: string; stripped: string | null } {
  const value = String(text ?? "");
  const match = PROVIDER_ERROR_TAIL.exec(value);
  if (!match) return { text: value, stripped: null };
  return { text: value.slice(0, match.index).trimEnd(), stripped: match[0].trim() };
}
