/**
 * Runtime-only name-trigger overrides supplied by a sibling control plugin
 * (for example openclaw-zalo-mod's dashboard).
 *
 * Like the group-policy overrides, these are intentionally kept out of
 * openclaw.json: writing a channel account entry makes the gateway restart.
 * The channel monitor merges this map into the silent-mode name gate for every
 * inbound group message, so alias edits take effect immediately — no restart,
 * before relay/model token usage.
 *
 * Persistence belongs to the caller (for example Zalo Mod settings.json). The
 * caller replays its aliases after a real gateway restart.
 */

const overrides = new Map<string, string[]>();

function normalizeAccountId(accountId?: string): string {
  return String(accountId || "default").trim() || "default";
}

/**
 * Trim, drop blanks, de-dupe case-insensitively while preserving the first
 * spelling as typed (the gate normalizes accents/case at match time anyway).
 */
export function sanitizeTriggers(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function setRuntimeNameTriggers(accountId: string | undefined, list: unknown): string[] {
  const clean = sanitizeTriggers(list);
  const id = normalizeAccountId(accountId);
  if (clean.length === 0) overrides.delete(id);
  else overrides.set(id, clean);
  return [...clean];
}

export function getRuntimeNameTriggers(accountId?: string): string[] {
  return [...(overrides.get(normalizeAccountId(accountId)) ?? [])];
}

export function clearRuntimeNameTriggers(accountId?: string): boolean {
  return overrides.delete(normalizeAccountId(accountId));
}

/** Test/reload helper; not exposed on the public bridge. */
export function clearAllRuntimeNameTriggers(): void {
  overrides.clear();
}
