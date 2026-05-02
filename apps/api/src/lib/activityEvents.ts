import { db } from "../db/client.js";

export type ActivityEventInput = {
  eventType: string;
  actorDiscordUserId?: string | null;
  targetDiscordUserId?: string | null;
  targetAppId?: number | null;
  targetGameNightId?: number | null;
  payload?: Record<string, unknown>;
};

async function resolveInternalUserId(discordUserId: string | null | undefined): Promise<number | null> {
  if (!discordUserId) return null;
  const result = await db.query<{ id: number }>(
    `SELECT id FROM users WHERE discord_user_id = $1 LIMIT 1`,
    [discordUserId]
  );
  return result.rows[0]?.id ?? null;
}

export async function recordEvent(input: ActivityEventInput): Promise<void> {
  try {
    const [actorId, targetId] = await Promise.all([
      resolveInternalUserId(input.actorDiscordUserId ?? null),
      resolveInternalUserId(input.targetDiscordUserId ?? null)
    ]);

    await db.query(
      `
        INSERT INTO activity_events (
          event_type,
          actor_user_id,
          target_user_id,
          target_app_id,
          target_game_night_id,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        input.eventType,
        actorId,
        targetId,
        input.targetAppId ?? null,
        input.targetGameNightId ?? null,
        JSON.stringify(input.payload ?? {})
      ]
    );
  } catch (error) {
    console.error("[activityEvents] recordEvent failed", error);
  }
}
