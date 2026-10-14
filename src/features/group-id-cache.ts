/**
 * In-memory cache of known Zalo group IDs.
 *
 * When zalo-connect receives a group message, the group ID is recorded here.
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

/**
 * Ids we asked Zalo about and learned are NOT groups. Kept so a DM target does not cost a
 * getGroupInfo call on every send.
 */
const knownNonGroupIds = new Set<string>();

export type OutboundTarget = { id: string; isGroup?: boolean };

/**
 * Split an outbound `to` into the bare thread id and, when the target spells it out, its kind.
 * OpenClaw's `message` tool hands the target through as the model wrote it, so `group:<id>`,
 * `zalo-connect:group:<id>` and `user:<id>` all show up and must not reach Zalo with the prefix.
 */
export function parseOutboundTarget(to: string): OutboundTarget {
  let id = String(to ?? "").trim().replace(/^zalo-connect:/i, "");
  if (/^group:/i.test(id)) return { id: id.replace(/^group:/i, "").trim(), isGroup: true };
  if (/^(user|dm|direct):/i.test(id)) return { id: id.replace(/^(user|dm|direct):/i, "").trim(), isGroup: false };
  return { id };
}

/**
 * Decide whether an outbound target is a group. Order: what the target says, the in-memory cache
 * of groups seen this run, then ask Zalo (`lookup`, normally getGroupInfo) once and remember.
 *
 * The cache alone was not enough: it only fills when a group message ARRIVES after the gateway
 * starts. vps_minh-thu, 12/10/2026: right after a gateway restart the bot sent a banner to its
 * group through the `message` tool, the group was not cached yet, so the image went out as a 1:1
 * message to that id and landed in a separate conversation, while text sent through the
 * zalo-connect tool (which passes isGroup explicitly) reached the real group.
 */
export async function resolveOutboundIsGroup(
  target: OutboundTarget,
  lookup: (id: string) => Promise<boolean | undefined>,
): Promise<boolean> {
  if (typeof target.isGroup === "boolean") {
    if (target.isGroup) recordGroupId(target.id);
    return target.isGroup;
  }
  if (isKnownGroupId(target.id)) return true;
  if (knownNonGroupIds.has(target.id)) return false;
  let isGroup: boolean | undefined;
  try {
    isGroup = await lookup(target.id);
  } catch {
    isGroup = undefined;
  }
  if (isGroup === true) recordGroupId(target.id);
  else if (isGroup === false) knownNonGroupIds.add(target.id);
  return isGroup === true;
}

/** Test helper: forget everything learned so far. */
export function resetGroupIdCacheForTest(): void {
  knownGroupIds.clear();
  knownNonGroupIds.clear();
}
