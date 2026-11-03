/**
 * Runtime state that every copy of this plugin in one gateway process must share.
 *
 * OpenClaw 2026.9.8 can evaluate the plugin module more than once in the same process (one
 * copy per plugin generation or agent registry). The bridge that a sibling control plugin
 * (Zalo Mod) writes to and the channel monitor that reads on every inbound message may then
 * come from different copies. A plain module-level Map gives each copy its own table, so a
 * silent mode, name alias or reaction choice written through the bridge never reaches the
 * monitor. Measured on vps_thuy-le 03/11/2026: after the 9.2 -> 9.8 upgrade the monitor stopped
 * buffering un-addressed group messages and kept reacting in groups set to "no reaction".
 *
 * Keeping the table on globalThis, next to the bridge service itself, gives every copy the same one.
 */
export function sharedMap<K, V>(key: string): Map<K, V> {
  const g = globalThis as Record<string, unknown>;
  const existing = g[key];
  if (existing instanceof Map) return existing as Map<K, V>;
  const created = new Map<K, V>();
  g[key] = created;
  return created;
}
