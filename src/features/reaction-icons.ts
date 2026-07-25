/**
 * Reaction icon resolver — turns whatever an operator wrote in config (or the model
 * passed to the add-reaction tool) into a reaction Zalo actually accepts.
 *
 * Zalo exposes 55 reactions, but its own wire format is legacy emoticon codes
 * (`:-*`, `/-rose`, `b-)`). zca-js maps those codes to the rType/source pair the API
 * wants; anything it does not recognise falls through to `rType: -1`, which Zalo
 * rejects — silently, from the caller's point of view. So an arbitrary emoji like 🦞
 * cannot be sent, and guessing produces a reaction that never appears.
 *
 * Accepted inputs, in priority order:
 *   1. a raw Zalo code            — ":-*", "b-)", "/-rose"
 *   2. a reaction name            — "kiss", "sunglasses", "tears_of_joy", "tears-of-joy"
 *   3. an emoji we can map        — "😘", "😎", "🌹"
 *
 * Unknown input returns undefined so callers can say so instead of firing a request
 * that cannot work.
 */

import { Reactions } from "zca-js";

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
 * Emoji → nearest Zalo reaction. Zalo draws its own art, so these are the closest
 * match rather than an exact glyph. Entries that carry U+FE0F (❤️, ✌️, ☀️) are listed
 * both with and without the variation selector, since either can arrive from config.
 */
const BY_EMOJI: Record<string, Reactions> = {
  "👍": Reactions.LIKE,
  "👎": Reactions.DISLIKE,
  "❤️": Reactions.HEART,
  "❤": Reactions.HEART,
  "💔": Reactions.BROKEN_HEART,
  "😆": Reactions.HAHA,
  "😂": Reactions.TEARS_OF_JOY,
  "🤣": Reactions.BIG_LAUGH,
  "😮": Reactions.WOW,
  "😲": Reactions.WOW,
  "😯": Reactions.SURPRISE,
  "👀": Reactions.SURPRISE,
  "😢": Reactions.CRY,
  "😭": Reactions.VERY_SAD,
  "😠": Reactions.ANGRY,
  "😡": Reactions.ANGRY_FACE,
  "😘": Reactions.KISS,
  "😍": Reactions.LOVE,
  "🥰": Reactions.LOVE_YOU,
  "😉": Reactions.WINK,
  "😕": Reactions.CONFUSED,
  "😎": Reactions.SUNGLASSES,
  "🤓": Reactions.NERD,
  "😃": Reactions.BIG_SMILE,
  "😄": Reactions.BIG_SMILE,
  "😐": Reactions.NEUTRAL,
  "😞": Reactions.SAD_FACE,
  "😔": Reactions.SAD,
  "🙁": Reactions.SAD2,
  "☹️": Reactions.SAD2,
  "😳": Reactions.EMBARRASSED,
  "😨": Reactions.AFRAID,
  "😩": Reactions.ANGUISH,
  "🤐": Reactions.SILENT,
  "😴": Reactions.SLEEPY,
  "😅": Reactions.WIPE,
  "🤑": Reactions.RICH,
  "👌": Reactions.OK,
  "✌️": Reactions.PEACE,
  "✌": Reactions.PEACE,
  "👊": Reactions.PUNCH,
  "👏": Reactions.HANDCLAP,
  "🙏": Reactions.PRAY,
  "👋": Reactions.BYE,
  "🚫": Reactions.NO,
  "🌹": Reactions.ROSE,
  "💩": Reactions.SHIT,
  "💣": Reactions.BOMB,
  "🎂": Reactions.BIRTHDAY,
  "☀️": Reactions.SUN,
  "☀": Reactions.SUN,
  "🍺": Reactions.BEER,
  "🍻": Reactions.BEER,
};

/** Extra spellings that are neither the enum name nor an emoji. */
const EXTRA_ALIASES: Record<string, Reactions> = {
  thumbsup: Reactions.LIKE,
  "thumbs-up": Reactions.LIKE,
  thumbsdown: Reactions.DISLIKE,
  laugh: Reactions.HAHA,
  lol: Reactions.BIG_LAUGH,
  surprised: Reactions.WOW,
  eyes: Reactions.SURPRISE,
  clap: Reactions.HANDCLAP,
  thanks: Reactions.THANKS,
  "thank-you": Reactions.THANKS,
  off: Reactions.NONE,
  remove: Reactions.NONE,
  clear: Reactions.NONE,
};

const ALIASES: Record<string, Reactions> = { ...BY_NAME, ...EXTRA_ALIASES };

/**
 * Resolve config/tool input to a reaction code, or undefined when nothing matches.
 * Emoji lookup is case-preserving; names are matched case-insensitively.
 */
export function resolveReactionIcon(raw: string): Reactions | undefined {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return undefined;
  if (VALID_CODES.has(trimmed)) return trimmed as Reactions;
  const byEmoji = BY_EMOJI[trimmed];
  if (byEmoji !== undefined) return byEmoji;
  return ALIASES[trimmed.toLowerCase()];
}

/** Names accepted by resolveReactionIcon, for error messages and docs. */
export function knownReactionNames(): string[] {
  return (Object.keys(Reactions) as string[]).map((n) => n.toLowerCase()).sort();
}
