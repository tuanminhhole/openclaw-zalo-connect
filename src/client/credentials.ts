/**
 * Credential storage with security hardening.
 *
 * [H1] File permissions set to 0600 (owner read/write only).
 * Note: Full encryption is not implemented here to avoid key management complexity,
 * but file permissions prevent other users/processes from reading credentials.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, chmodSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

function normalizeAccountId(accountId?: string | null): string {
  return String(accountId || "default").trim() || "default";
}

/**
 * Thư mục state THẬT của project, không phải HOME của tài khoản hệ điều hành.
 *
 * Bản cũ ghi cứng `homedir()/.openclaw`, nên mọi project trên cùng một máy — nhiều bot, nhiều
 * khách, cả sandbox lẫn bản chạy thật — dùng CHUNG một file phiên Zalo: cái sau ghi đè cái trước,
 * và một lần thử nghiệm là đủ đá văng phiên của bot đang phục vụ khách. Kênh chính chủ
 * @openclaw/zalouser đặt phiên dưới `resolveStateDir(env)/credentials/zalouser/`, mình theo đúng
 * thế: OPENCLAW_STATE_DIR → OPENCLAW_HOME → ~/.openclaw.
 */
function stateDir(): string {
  const fromEnv = process.env.OPENCLAW_STATE_DIR?.trim() || process.env.OPENCLAW_HOME?.trim();
  return fromEnv || join(homedir(), ".openclaw");
}

function credentialSuffix(accountId?: string | null): string {
  const normalized = normalizeAccountId(accountId);
  return normalized === "default" ? "" : `-${normalized.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** Đường dẫn CŨ (ghi cứng HOME) — chỉ còn dùng để di trú một lần. */
function legacyCredentialPath(accountId?: string | null): string {
  return join(homedir(), ".openclaw", `zalo-connect-credentials${credentialSuffix(accountId)}.json`);
}

function credentialPath(accountId?: string | null): string {
  const path = join(stateDir(), "credentials", "zalo-connect", `credentials${credentialSuffix(accountId)}.json`);
  migrateLegacyCredentials(accountId, path);
  return path;
}

/**
 * Dời phiên cũ sang chỗ mới đúng MỘT lần, im lặng. Khách đã quét QR rồi thì không phải quét lại
 * khi lên bản này; file cũ được đổi tên thành `.migrated` chứ không xoá, để còn quay lại được.
 */
function migrateLegacyCredentials(accountId: string | null | undefined, target: string): void {
  if (existsSync(target)) return;
  const legacy = legacyCredentialPath(accountId);
  if (legacy === target || !existsSync(legacy)) return;
  try {
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(target, readFileSync(legacy, "utf-8"), { encoding: "utf-8", mode: 0o600 });
    try { chmodSync(target, 0o600); } catch { /* Windows */ }
    renameSync(legacy, `${legacy}.migrated`);
  } catch {
    // Di trú hụt thì kệ: đường đọc bên dưới vẫn tự xử, cùng lắm khách quét QR lại.
  }
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
