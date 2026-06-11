import { RecommendationInput, RecommendedGame } from "@island/shared";
import { db } from "../db/client.js";

type GameRow = {
  app_id: number;
  name: string;
  owners: number;
  // Real capability signal from migration 045 (replaces the fabricated
  // max_players / median_session_minutes DB defaults that nothing ever wrote).
  is_single_player: boolean;
  is_online_coop: boolean;
  is_lan_coop: boolean;
  is_shared_split_coop: boolean;
  is_online_pvp: boolean;
  is_mmo: boolean;
  mp_max_players_approx: number | null;
  // Used to detect generic multiplayer/co-op (Steam categories 1/9) which set no
  // specific bool but still mark a game as multiplayer-capable. Persisted category
  // descriptions land in tags, so we sniff them here.
  tags: string[] | null;
};

// A game counts as multiplayer-capable if any specific multiplayer bool is set
// OR it carries a generic Multi-player / Co-op tag (Steam categories 1/9 set no
// specific bool). is_single_player reflects only Steam category 2, so it does not
// preclude multiplayer.
function isMultiplayerCapable(row: GameRow): boolean {
  if (
    row.is_online_coop ||
    row.is_lan_coop ||
    row.is_shared_split_coop ||
    row.is_online_pvp ||
    row.is_mmo
  ) {
    return true;
  }
  return (row.tags ?? []).some((tag) => /multi-?player|co-?op/i.test(tag));
}

// Scoring (no real session-length signal exists — median_session_minutes was
// always fabricated — so sessionFit is removed and its weight folded into the two
// honest signals):
//   score = ownershipCoverage * 60 + groupFit * 40
// groupFit reflects real multiplayer capability for the requested group size:
//   - solo request (1 member): any game fits (groupFit = 1)
//   - group request: single-player-only games are a poor fit (low groupFit);
//     multiplayer-capable games fit well; if a known mp_max_players_approx is
//     smaller than the group, groupFit is reduced.
function scoreGame(row: GameRow, input: RecommendationInput): RecommendedGame {
  const groupSize = input.memberIds.length;
  const ownershipCoverage = row.owners / groupSize;

  let groupFit: number;
  if (groupSize <= 1) {
    groupFit = 1;
  } else if (isMultiplayerCapable(row)) {
    groupFit =
      row.mp_max_players_approx != null && row.mp_max_players_approx < groupSize ? 0.6 : 1;
  } else {
    // Single-player-only (or no multiplayer signal at all) for a group request.
    groupFit = 0.3;
  }

  const score = Math.round((ownershipCoverage * 60 + groupFit * 40) * 100) / 100;
  const missing = Math.max(0, groupSize - row.owners);
  return {
    appId: row.app_id,
    name: row.name,
    owners: row.owners,
    selectedMembers: groupSize,
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
        g.is_single_player,
        g.is_online_coop,
        g.is_lan_coop,
        g.is_shared_split_coop,
        g.is_online_pvp,
        g.is_mmo,
        g.mp_max_players_approx,
        g.tags,
        COUNT(*)::int AS owners
      FROM user_games ug
      INNER JOIN games g ON g.app_id = ug.app_id
      INNER JOIN users u ON u.id = ug.user_id
      WHERE u.discord_user_id = ANY($1::text[])
      GROUP BY g.app_id, g.name, g.is_single_player, g.is_online_coop,
               g.is_lan_coop, g.is_shared_split_coop, g.is_online_pvp,
               g.is_mmo, g.mp_max_players_approx, g.tags
      HAVING COUNT(*) >= GREATEST(1, $2::int - 1)
      ORDER BY owners DESC, g.name ASC
      LIMIT 20
    `,
    [input.memberIds, input.memberIds.length]
  );
  return result.rows.map((row) => scoreGame(row, input)).sort((a, b) => b.score - a.score);
}
