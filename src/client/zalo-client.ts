import { Zalo, LoginQRCallbackEventType, type API } from "zca-js";
import type { LoginQRCallbackEvent } from "zca-js";
import {
  saveCredentials,
  loadCredentials,
  deleteCredentials,
  hasCredentials,
} from "./credentials.js";
import { readImageMetadata } from "../media/image-metadata.js";

const apiInstances = new Map<string, API>();
const currentUids = new Map<string, string>();
/** Bot's own Zalo display name per account — used for name-trigger gating in groups. */
const currentNames = new Map<string, string>();
/** [H2] Promise memoization to prevent concurrent login attempts per account. */
const loginPromises = new Map<string, Promise<API>>();

function normalizeAccountId(accountId?: string | null): string {
  return String(accountId || "default").trim() || "default";
}

export type QrCallback = (event: LoginQRCallbackEvent) => unknown;

async function imageMetadataGetter(filePath: string) {
  return readImageMetadata(filePath);
}

export async function loginWithQR(callback?: QrCallback, accountId?: string | null): Promise<API> {
  const id = normalizeAccountId(accountId);
  // selfListen:true is required for reliable self-message recall: the send API does
  // not return a usable cliMsgId, so the self-echo delivered to our own listener is
  // the only reliable source of it (see monitor.ts message handler). The earlier
  // multi-account "starvation" this was blamed for was actually a GLOBAL msgId dedup
  // that cross-dropped messages between accounts — now fixed (per-account dedup key),
  // so self-echo adds only marginal ws load and no longer harms multi-account.
  const zalo = new Zalo({ logging: false, selfListen: true, imageMetadataGetter });
  const api = await zalo.loginQR(undefined, (event) => {
    if (event.type === LoginQRCallbackEventType.GotLoginInfo && event.data) {
      saveCredentials({
        imei: event.data.imei,
        cookie: event.data.cookie,
        userAgent: event.data.userAgent,
      }, id);
    }
    callback?.(event);
  });
  apiInstances.set(id, api);
  try {
    const raw = await api.fetchAccountInfo();
    const info = (raw as any)?.profile ?? raw;
    if (info?.userId) currentUids.set(id, String(info.userId));
    if (info?.displayName) currentNames.set(id, String(info.displayName));
  } catch {
    // non-critical
  }
  return api;
}

export async function loginWithCredentials(accountId?: string | null): Promise<API> {
  const id = normalizeAccountId(accountId);
  const creds = loadCredentials(id);
  if (!creds) {
    throw new Error("No saved credentials found. Login with QR first.");
  }
  // selfListen:true is required for reliable self-message recall (see loginWithQR).
  const zalo = new Zalo({ logging: false, selfListen: true, imageMetadataGetter });
  const api = await zalo.login({
    imei: creds.imei,
    cookie: creds.cookie as any,
    userAgent: creds.userAgent,
    language: creds.language,
  });
  apiInstances.set(id, api);
  try {
    const raw = await api.fetchAccountInfo();
    const info = (raw as any)?.profile ?? raw;
    if (info?.userId) currentUids.set(id, String(info.userId));
    if (info?.displayName) currentNames.set(id, String(info.displayName));
  } catch {
    // non-critical
  }
  return api;
}

/**
 * Get the API singleton safely with race condition protection.
 * [H2] Uses promise memoization — concurrent callers wait for the same login attempt.
 */
export async function getApi(accountId?: string | null): Promise<API> {
  const id = normalizeAccountId(accountId);
  const existing = apiInstances.get(id);
  if (existing) {
    return existing;
  }
  if (!hasCredentials(id)) {
    throw new Error(`Not authenticated for account "${id}". Login with QR first.`);
  }
  // If a login is already in progress, wait for it
  const pending = loginPromises.get(id);
  if (pending) {
    return pending;
  }
  // Start login and memoize the promise
  const promise = loginWithCredentials(id).finally(() => {
    loginPromises.delete(id);
  });
  loginPromises.set(id, promise);
  return promise;
}

export function getApiSync(accountId?: string | null): API | null {
  return apiInstances.get(normalizeAccountId(accountId)) ?? null;
}

export function getCurrentUid(accountId?: string | null): string | null {
  return currentUids.get(normalizeAccountId(accountId)) ?? null;
}

/** Bot's own Zalo display name for this account (if fetched), for name-trigger gating. */
export function getCurrentName(accountId?: string | null): string | null {
  return currentNames.get(normalizeAccountId(accountId)) ?? null;
}

export function isAuthenticated(accountId?: string | null): boolean {
  return apiInstances.has(normalizeAccountId(accountId));
}

export function hasStoredCredentials(accountId?: string | null): boolean {
  return hasCredentials(normalizeAccountId(accountId));
}

export async function logout(accountId?: string | null): Promise<void> {
  const id = normalizeAccountId(accountId);
  apiInstances.delete(id);
  currentUids.delete(id);
  currentNames.delete(id);
  loginPromises.delete(id);
  deleteCredentials(id);
}

/**
 * Drop the cached API instance for an account WITHOUT clearing its stored
 * credentials, so the next getApi() rebuilds a fresh session + listener from
 * the saved cookies. Used by the monitor to recover a stalled/closed listener
 * (esp. the 2nd+ account when running multiple Zalo sessions in one process) —
 * restarting the SAME (dead) listener does not recover; a fresh api does.
 */
export function invalidateApi(accountId?: string | null): void {
  const id = normalizeAccountId(accountId);
  apiInstances.delete(id);
  currentUids.delete(id);
  currentNames.delete(id);
  loginPromises.delete(id);
}

export async function ensureAuthenticated(accountId?: string | null): Promise<API> {
  return getApi(accountId);
}
