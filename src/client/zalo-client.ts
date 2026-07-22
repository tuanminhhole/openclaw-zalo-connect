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
  loginPromises.delete(id);
  deleteCredentials(id);
}

export async function ensureAuthenticated(accountId?: string | null): Promise<API> {
  return getApi(accountId);
}
