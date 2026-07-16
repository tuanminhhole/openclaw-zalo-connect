import type { OpenClawConfig } from "openclaw/plugin-sdk/channel-core";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/channel-plugin-common";
import type { ResolvedZaloConnectAccount, ZaloConnectAccountConfig, ZaloConnectConfig } from "../runtime/types.js";
import { hasStoredCredentials } from "./zalo-client.js";

function listConfiguredAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = (cfg.channels?.['zalo-connect'] as ZaloConnectConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listZaloConnectAccountIds(cfg: OpenClawConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.toSorted((a, b) => a.localeCompare(b));
}

export function resolveDefaultZaloConnectAccountId(cfg: OpenClawConfig): string {
  const zaloConnectConfig = cfg.channels?.['zalo-connect'] as ZaloConnectConfig | undefined;
  if (zaloConnectConfig?.defaultAccount?.trim()) return zaloConnectConfig.defaultAccount.trim();
  const ids = listZaloConnectAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): ZaloConnectAccountConfig | undefined {
  const accounts = (cfg.channels?.['zalo-connect'] as ZaloConnectConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as ZaloConnectAccountConfig | undefined;
}

function mergeZaloConnectAccountConfig(cfg: OpenClawConfig, accountId: string): ZaloConnectAccountConfig {
  const raw = (cfg.channels?.['zalo-connect'] ?? {}) as ZaloConnectConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export async function checkZaloConnectAuthenticated(accountId?: string | null): Promise<boolean> {
  return hasStoredCredentials(accountId);
}

export async function resolveZaloConnectAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): Promise<ResolvedZaloConnectAccount> {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled =
    (params.cfg.channels?.['zalo-connect'] as ZaloConnectConfig | undefined)?.enabled !== false;
  const merged = mergeZaloConnectAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const authenticated = await checkZaloConnectAuthenticated(accountId);
  return { accountId, name: merged.name?.trim() || undefined, enabled, authenticated, config: merged };
}

export function resolveZaloConnectAccountSync(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedZaloConnectAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled =
    (params.cfg.channels?.['zalo-connect'] as ZaloConnectConfig | undefined)?.enabled !== false;
  const merged = mergeZaloConnectAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  return { accountId, name: merged.name?.trim() || undefined, enabled, authenticated: false, config: merged };
}

export async function listEnabledZaloConnectAccounts(
  cfg: OpenClawConfig,
): Promise<ResolvedZaloConnectAccount[]> {
  const ids = listZaloConnectAccountIds(cfg);
  const accounts = await Promise.all(
    ids.map((accountId) => resolveZaloConnectAccount({ cfg, accountId })),
  );
  return accounts.filter((account) => account.enabled);
}

export async function getZaloConnectUserInfo(accountId?: string | null): Promise<{ userId?: string; displayName?: string } | null> {
  try {
    const { getApi } = await import("./zalo-client.js");
    const api = await getApi(accountId);
    const raw = await api.fetchAccountInfo();
    const info = (raw as any)?.profile ?? raw;
    return info ? { userId: info.userId, displayName: info.displayName } : null;
  } catch {
    return null;
  }
}

export type { ResolvedZaloConnectAccount } from "../runtime/types.js";
