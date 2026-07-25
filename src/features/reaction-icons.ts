/**
 * Reaction icon resolver — turns whatever an operator wrote in config (or the model
 * passed to the add-reaction tool) into a reaction Zalo actually accepts.
 *
 * Zalo has two separate reaction mechanisms:
 *
 *  1. **Built-in reactions**, addressed by legacy emoticon codes (`:-*`, `/-rose`,
 *     `b-)`). zca-js maps each code to a fixed rType. Their *artwork* no longer
 *     matches the enum names it inherited — SURPRISE (`:-o`, rType 53) renders as a
 *     kissing face today — so picking a built-in by name is a guess about what the
 *     user will actually see.
 *  2. **Custom reactions**, which is how Zalo Web sends an arbitrary emoji: it passes
 *     the emoji itself as `rIcon` and a *hash of that emoji* as `rType`
 *     (`generateReactionHash` below, ported from the web client). Zalo then renders
 *     exactly that emoji.
 *
 * So emoji go through mechanism 2, not through a best-guess built-in. That is what
 * makes 👀 render as 👀 rather than as whatever art the nearest built-in happens to
 * carry this month, and it is why an emoji outside Zalo's own set can be sent at all.
 *
 * Accepted inputs, in priority order:
 *   1. a raw Zalo code            — ":-*", "b-)", "/-rose"      → built-in
 *   2. a reaction name            — "kiss", "sunglasses"         → built-in
 *   3. any emoji                  — "👀", "😎", "🔥"             → custom reaction
 *
 * Unknown input returns undefined so callers can say so instead of firing a request
 * that cannot work.
 */

import { Reactions, type CustomReaction } from "zca-js";

/** Every wire code zca-js knows, for pass-through of raw codes. */
const VALID_CODES: ReadonlySet<string> = new Set(Object.values(Reactions) as string[]);

/**
 * Enum names → code, in the spellings people actually type:
 * TEARS_OF_JOY also answers to "tearsofjoy" and "tears-of-joy".
 */
const BY_NAME: Record<string, Reactions> = Object.fromEntries(
  (Object.entries(Reactions) as [string, Reactions][]).flatMap(([name, code]) => {
    const lower = name.toLowerCase();
    return [
      [lower, code],
      [lower.replace(/_/g, ""), code],
      [lower.replace(/_/g, "-"), code],
    ];
  }),
);

/**
 * Numeric type Zalo Web assigns to an emoji reaction: a DJB2-style hash over UTF-16
 * code units, truncated to int32 each round, then made positive. Ported verbatim from
 * the web client so our rType matches what a real Zalo client would send for the same
 * emoji — a mismatch shows up as a reaction that silently never appears.
 */
export function generateReactionHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Two emoji Zalo Web ships as fixed types rather than hashing. Use its numbers so
 * these land in the same bucket as a reaction sent from the official client.
 */
const FIXED_EMOJI_TYPES: Record<string, number> = {
  "👏": 100,
  "🎉": 101,
};

/** Reaction source id; every built-in in zca-js uses 6, and custom reactions ride the same endpoint. */
const REACTION_SOURCE = 6;

/** Build the custom-reaction payload Zalo expects for an arbitrary emoji. */
function customReaction(icon: string): CustomReaction {
  return { rType: FIXED_EMOJI_TYPES[icon] ?? generateReactionHash(icon), source: REACTION_SOURCE, icon };
}

/**
 * Does this look like an emoji (or other pictograph) rather than a legacy emoticon
 * code? Zalo's own codes are pure ASCII punctuation, so any non-ASCII input is an
 * emoji and belongs on the custom-reaction path.
 */
function looksLikeEmoji(s: string): boolean {
  return /[^\x00-\x7F]/.test(s);
}

/** Extra spellings that are neither the enum name nor an emoji. */
const EXTRA_ALIASES: Record<string, Reactions> = {
  thumbsup: Reactions.LIKE,
  "thumbs-up": Reactions.LIKE,
  thumbsdown: Reactions.DISLIKE,
  laugh: Reactions.HAHA,
  lol: Reactions.BIG_LAUGH,
  surprised: Reactions.WOW,
  clap: Reactions.HANDCLAP,
  thanks: Reactions.THANKS,
  "thank-you": Reactions.THANKS,
  off: Reactions.NONE,
  remove: Reactions.NONE,
  clear: Reactions.NONE,
};

const ALIASES: Record<string, Reactions> = { ...BY_NAME, ...EXTRA_ALIASES };

/**
 * Resolve config/tool input to something api.addReaction accepts, or undefined when
 * nothing matches. Raw codes and names give a built-in reaction; an emoji gives a
 * custom reaction carrying that exact glyph. Names are matched case-insensitively.
 */
export function resolveReactionIcon(raw: string): Reactions | CustomReaction | undefined {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return undefined;
  if (VALID_CODES.has(trimmed)) return trimmed as Reactions;
  const byName = ALIASES[trimmed.toLowerCase()];
  if (byName !== undefined) return byName;
  if (looksLikeEmoji(trimmed)) return customReaction(trimmed);
  return undefined;
}

/** Names accepted by resolveReactionIcon, for error messages and docs. */
export function knownReactionNames(): string[] {
  return (Object.keys(Reactions) as string[]).map((n) => n.toLowerCase()).sort();
}
