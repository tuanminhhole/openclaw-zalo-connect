/**
 * Per-group override for the automatic acknowledgement reaction (`messages.ackReaction`).
 *
 * OpenClaw only knows one global ack emoji plus a scope (all / dm-only / group-mentions / off),
 * so an owner could not say "react in this group, stay quiet in that one" (asked for on vps_asa,
 * 22/10/2026). A sibling control plugin (Zalo Mod) sets the override per group; it is RAM-only like
 * the free/silent/mute policy, and the caller replays it after a gateway restart.
 *
 * Kept apart from RuntimeGroupPolicy on purpose: setRuntimeGroupPolicy replaces the whole policy
 * object on every mode change, which would silently drop a reaction choice stored next to it.
 *
 *   true  = always react in this group (with the global emoji, or DEFAULT_GROUP_ACK_REACTION when
 *           none is configured), whatever the global scope says
 *   false = never react in this group
 *   unset = follow messages.ackReaction / messages.ackReactionScope
 */

export const DEFAULT_GROUP_ACK_REACTION = "/-heart";

const overrides = new Map<string, boolean>();

function key(accountId: string | undefined, groupId: string): string {
  const account = String(accountId || "default").trim() || "default";
  const group = String(groupId || "").trim().replace(/^group:/, "");
  return `${account}|${group}`;
}

export function setRuntimeGroupAckReaction(
  accountId: string | undefined,
  groupId: string,
  enabled: boolean | null | undefined,
): boolean | undefined {
  const group = String(groupId || "").trim().replace(/^group:/, "");
  if (!group) throw new Error("groupId required");
  if (enabled === null || enabled === undefined) {
    overrides.delete(key(accountId, group));
    return undefined;
  }
  if (typeof enabled !== "boolean") throw new Error(`invalid ack reaction value: ${String(enabled)}`);
  overrides.set(key(accountId, group), enabled);
  return enabled;
}

export function getRuntimeGroupAckReaction(
  accountId: string | undefined,
  groupId: string,
): boolean | undefined {
  return overrides.get(key(accountId, groupId));
}

/** Test/reload helper; not exposed on the public bridge. */
export function clearAllRuntimeGroupAckReactions(): void {
  overrides.clear();
}

/**
 * Decide the emoji to send for one inbound message, or "" for none.
 * `globalShouldAck` is the answer of the core scope rules for this message.
 */
export function resolveAckReactionForMessage(params: {
  globalEmoji: string;
  globalShouldAck: boolean;
  groupOverride: boolean | undefined;
}): string {
  const globalEmoji = String(params.globalEmoji || "").trim();
  if (params.groupOverride === false) return "";
  if (params.groupOverride === true) return globalEmoji || DEFAULT_GROUP_ACK_REACTION;
  return params.globalShouldAck ? globalEmoji : "";
}
