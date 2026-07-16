/**
 * Credential storage with security hardening.
 *
 * [H1] File permissions set to 0600 (owner read/write only).
 * Note: Full encryption is not implemented here to avoid key management complexity,
 * but file permissions prevent other users/processes from reading credentials.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, chmodSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

function normalizeAccountId(accountId?: string | null): string {
  return String(accountId || "default").trim() || "default";
}

function credentialPath(accountId?: string | null): string {
  const normalized = normalizeAccountId(accountId);
  const suffix = normalized === "default"
    ? ""
    : `-${normalized.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  return join(homedir(), ".openclaw", `zalo-connect-credentials${suffix}.json`);
}

export type ZaloConnectCredentials = {
  imei: string;
  cookie: unknown;
  userAgent: string;
  language?: string;
};

/**
 * Save credentials to disk with restrictive file permissions.
 * [H1] chmod 0600 — only the file owner can read/write.
 */
export function saveCredentials(data: ZaloConnectCredentials, accountId?: string | null): void {
  const path = credentialPath(accountId);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  writeFileSync(path, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  // Ensure permissions even if file existed with different mode
  try { chmodSync(path, 0o600); } catch {
    // Non-critical — may fail on Windows
  }
}

export function loadCredentials(accountId?: string | null): ZaloConnectCredentials | null {
  const path = credentialPath(accountId);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as ZaloConnectCredentials;
  } catch {
    return null;
  }
}

export function deleteCredentials(accountId?: string | null): void {
  const path = credentialPath(accountId);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function hasCredentials(accountId?: string | null): boolean {
  return existsSync(credentialPath(accountId));
}

export function refreshCredentials(freshCookies: unknown, accountId?: string | null): void {
  const existing = loadCredentials(accountId);
  if (!existing) return;
  existing.cookie = freshCookies;
  saveCredentials(existing, accountId);
}
