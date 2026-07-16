/**
 * Runtime-only group policy overrides supplied by a sibling control plugin.
 *
 * These overrides are intentionally kept out of openclaw.json: changing a
 * channel group entry makes the gateway restart.  The channel monitor reads
 * this map for every inbound message, so free/silent/mute changes take effect
 * immediately and before the OpenClaw dispatch/model pipeline.
 *
 * Persistence belongs to the caller (for example Zalo Mod settings.json).
 * The caller replays its policies after a real gateway restart.
 */

export type RuntimeGroupMode = "free" | "silent" | "mute";

export type RuntimeGroupPolicy = {
  mode: RuntimeGroupMode;
  enabled: boolean;
  requireMention: boolean;
  updatedAt: number;
};

const policies = new Map<string, RuntimeGroupPolicy>();

function normalizeAccountId(accountId?: string): string {
  return String(accountId || "default").trim() || "default";
}

function normalizeGroupId(groupId: string): string {
  return String(groupId || "").trim().replace(/^group:/, "");
}

function policyKey(accountId: string | undefined, groupId: string): string {
  return `${normalizeAccountId(accountId)}|${normalizeGroupId(groupId)}`;
}

export function setRuntimeGroupPolicy(
  accountId: string | undefined,
  groupId: string,
  mode: RuntimeGroupMode,
): RuntimeGroupPolicy {
  const normalizedGroupId = normalizeGroupId(groupId);
  if (!normalizedGroupId) throw new Error("groupId required");
  if (mode !== "free" && mode !== "silent" && mode !== "mute") {
    throw new Error(`invalid group mode: ${String(mode)}`);
  }
  const policy: RuntimeGroupPolicy = {
    mode,
    enabled: mode !== "mute",
    requireMention: mode !== "free",
    updatedAt: Date.now(),
  };
  policies.set(policyKey(accountId, normalizedGroupId), policy);
  return { ...policy };
}

export function getRuntimeGroupPolicy(
  accountId: string | undefined,
  groupId: string,
): RuntimeGroupPolicy | undefined {
  const policy = policies.get(policyKey(accountId, groupId));
  return policy ? { ...policy } : undefined;
}

export function clearRuntimeGroupPolicy(accountId: string | undefined, groupId: string): boolean {
  return policies.delete(policyKey(accountId, groupId));
}

/** Test/reload helper; not exposed on the public bridge. */
export function clearAllRuntimeGroupPolicies(): void {
  policies.clear();
}
