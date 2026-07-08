/**
 * In-memory cache of known Zalo group IDs.
 *
 * When zaloclaw receives a group message, the group ID is recorded here.
 * outbound.sendText/sendMedia use this to determine isGroup without an API call.
 *
 * Thread-safe: Set operations are synchronous in Node.js single-threaded runtime.
 */

const knownGroupIds = new Set<string>();

/** Record a group ID when a group message arrives. */
export function recordGroupId(id: string): void {
  if (id?.trim()) knownGroupIds.add(id.trim());
}

/** Check if an ID is a known Zalo group. */
export function isKnownGroupId(id: string): boolean {
  return knownGroupIds.has(id?.trim() ?? "");
}
