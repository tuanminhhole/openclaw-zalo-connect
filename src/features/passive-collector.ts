/**
 * Passive Group Message Collector
 *
 * Stores ALL Zalo group messages to a JSONL log file — no AI calls, no external services.
 *
 * Storage: ~/.openclaw/workspace/zalo-connect/passive/{groupId}.jsonl
 * Format: one JSON record per line (JSONL — text-visible, zero dependency)
 *
 * Design goals:
 *  - Portable: works on any OpenClaw install with no extra setup
 *  - Text-visible: files can be read with cat / grep / jq or the agent's read tool
 *  - Zero API cost: pure file I/O, never triggers an AI turn
 *  - Non-blocking: errors are swallowed in silent mode — never interrupts message flow
 *
 * turn_type = "passive" distinguishes these records from AI-exchange turns.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/** Root directory for all passive logs. One .jsonl file per group. */
export const PASSIVE_DIR = path.join(
  os.homedir(),
  ".openclaw",
  "workspace",
  "zalo-connect",
  "passive",
);

/** One record per line in the JSONL file. */
export interface PassiveRecord {
  /** ISO-8601 UTC timestamp */
  ts: string;
  /** Zalo group ID */
  group_id: string;
  /** Sender's Zalo user ID */
  sender_id: string;
  /** Sender's display name */
  sender_name: string;
  /** Message text content */
  msg: string;
  /** Zalo message ID (optional) */
  msg_id?: string;
  /** turn_type marker — always "passive" */
  turn_type: "passive";
}

export interface PassiveCollectorOptions {
  /** Group ID */
  groupId: string;
  /** Sender's Zalo user ID */
  senderId: string;
  /** Sender's display name */
  senderName: string;
  /** Message text content */
  content: string;
  /** Message ID from Zalo */
  msgId?: string;
  /** Suppress errors (default: true — never block message flow) */
  silent?: boolean;
}

/**
 * Append a single group message to the group's JSONL log.
 * Call this BEFORE the mention check — runs fire-and-forget.
 */
export function collectGroupMessage(opts: PassiveCollectorOptions): void {
  const { groupId, senderId, senderName, content, msgId, silent = true } = opts;

  if (!content?.trim()) return;

  try {
    fs.mkdirSync(PASSIVE_DIR, { recursive: true });

    const record: PassiveRecord = {
      ts: new Date().toISOString(),
      group_id: groupId,
      sender_id: senderId,
      sender_name: senderName,
      msg: content,
      turn_type: "passive",
      ...(msgId ? { msg_id: msgId } : {}),
    };

    const filePath = path.join(PASSIVE_DIR, `${groupId}.jsonl`);
    fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
  } catch (err) {
    if (!silent) throw err;
    // silent mode: swallow errors — never block message flow
  }
}

/**
 * Read and optionally filter records from a group's JSONL log.
 *
 * @param groupId  - Zalo group ID (maps to {groupId}.jsonl)
 * @param limit    - Max records to return (newest first). Default: 50.
 * @param query    - Optional keyword filter (case-insensitive, matches msg or sender_name).
 * @returns Array of matching PassiveRecord objects, newest first.
 */
export function recallGroupHistory(params: {
  groupId: string;
  limit?: number;
  query?: string;
}): PassiveRecord[] {
  const { groupId, limit = 50, query } = params;
  const filePath = path.join(PASSIVE_DIR, `${groupId}.jsonl`);

  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  let records: PassiveRecord[] = [];

  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as PassiveRecord);
    } catch {
      // skip malformed lines
    }
  }

  // Filter by keyword if provided
  if (query) {
    const q = query.toLowerCase();
    records = records.filter(
      (r) =>
        r.msg.toLowerCase().includes(q) ||
        r.sender_name.toLowerCase().includes(q),
    );
  }

  // Return newest first, capped at limit
  return records.reverse().slice(0, limit);
}

/**
 * List all groups that have a passive log file.
 * Returns array of { groupId, recordCount, lastTs }.
 */
export function listPassiveGroups(): Array<{
  groupId: string;
  recordCount: number;
  lastTs: string | null;
}> {
  if (!fs.existsSync(PASSIVE_DIR)) return [];

  const files = fs.readdirSync(PASSIVE_DIR).filter((f) => f.endsWith(".jsonl"));

  return files.map((filename) => {
    const groupId = filename.replace(/\.jsonl$/, "");
    const filePath = path.join(PASSIVE_DIR, filename);
    const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
    let lastTs: string | null = null;
    try {
      const last = JSON.parse(lines[lines.length - 1]) as Partial<PassiveRecord>;
      lastTs = last.ts ?? null;
    } catch { /* ignore */ }
    return { groupId, recordCount: lines.length, lastTs };
  });
}
