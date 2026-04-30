import { RecommendationInput, RecommendedGame } from "@island/shared";
import { db } from "../db/client.js";

type GameRow = {
  app_id: number;
  name: string;
  owners: number;
  max_players: number;
  median_session_minutes: number;
};

function scoreGame(row: GameRow, input: RecommendationInput): RecommendedGame {
  const ownershipCoverage = row.owners / input.memberIds.length;
  const groupFit = row.max_players >= input.memberIds.length ? 1 : 0.4;
  const sessionFit =
    input.sessionLength === "any"
      ? 1
      : input.sessionLength === "short"
        ? row.median_session_minutes <= 90
          ? 1
          : 0.6
        : row.median_session_minutes >= 90
          ? 1
          : 0.7;
  const score = Math.round((ownershipCoverage * 50 + groupFit * 30 + sessionFit * 20) * 100) / 100;
  const missing = Math.max(0, input.memberIds.length - row.owners);
  return {
    appId: row.app_id,
    name: row.name,
    owners: row.owners,
    selectedMembers: input.memberIds.length,
    nearMatchMissingMembers: missing,
    score,
    reason: missing === 0 ? "everyone owns it" : `${missing} member(s) missing`
  };
}

export async function whatCanWePlay(input: RecommendationInput): Promise<RecommendedGame[]> {
  const result = await db.query<GameRow>(
    `
      SELECT
        g.app_id,
        g.name,
        g.max_players,
        g.median_session_minutes,
        COUNT(*)::int AS owners
      FROM user_games ug
      INNER JOIN games g ON g.app_id = ug.app_id
      INNER JOIN users u ON u.id = ug.user_id
      WHERE u.discord_user_id = ANY($1::text[])
      GROUP BY g.app_id, g.name, g.max_players, g.median_session_minutes
      HAVING COUNT(*) >= GREATEST(1, $2::int - 1)
      ORDER BY owners DESC, g.name ASC
      LIMIT 20
    `,
    [input.memberIds, input.memberIds.length]
  );
  return result.rows.map((row) => scoreGame(row, input)).sort((a, b) => b.score - a.score);
}
