// Shared presence text helpers — used by /profile/me and /members so they
// always compose the same priority order and can never diverge.

/**
 * Maps a Discord activity name + type to a human-readable verb phrase.
 * Type values: 0 Playing, 1 Streaming, 2 Listening, 3 Watching, 5 Competing.
 * Type 4 (Custom Status) is filtered out at the bot before push.
 */
export function activityText(name: string | null, type: number | null): string | null {
  if (!name) return null;
  switch (type) {
    case 1: return `Streaming ${name}`;
    case 2: return `Listening to ${name}`;
    case 3: return `Watching ${name}`;
    case 5: return `Competing in ${name}`;
    case 0:
    default: return `Playing ${name}`;
  }
}

/**
 * Compose a single presence display string.
 * Priority: Discord game/stream activity → Steam in-game title → legacy voice text → null.
 */
export function composePresenceText(opts: {
  activityName: string | null;
  activityType: number | null;
  steamGameInfo: string | null;
  richPresenceText: string | null;
}): string | null {
  return (
    activityText(opts.activityName, opts.activityType) ??
    opts.steamGameInfo ??
    opts.richPresenceText ??
    null
  );
}
