/**
 * Name-trigger matching for the group gate: a silent-mode bot (requireMention) should
 * also respond when addressed by NAME (its Zalo display name or a configured alias),
 * not only by @mention. Matching is accent-insensitive (Vietnamese) and case-insensitive,
 * with word-ish boundaries so short aliases (e.g. "mei", "mkt") don't match inside
 * unrelated words.
 */

function stripAccents(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalize(input: string): string {
  return stripAccents(String(input || "")).toLowerCase().trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True if `text` addresses any of `names` as a standalone token (accent/case-insensitive).
 * Empty/blank names are ignored. Names shorter than 2 chars are ignored to avoid noise.
 */
export function textMentionsAnyName(text: string, names: Array<string | undefined | null>): boolean {
  const hay = normalize(text);
  if (!hay) return false;
  for (const raw of names) {
    const n = normalize(String(raw ?? ""));
    if (n.length < 2) continue;
    // Boundary = start/end or any non-letter/non-digit char (Unicode-aware).
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(n)}([^\\p{L}\\p{N}]|$)`, "u");
    if (re.test(hay)) return true;
  }
  return false;
}
