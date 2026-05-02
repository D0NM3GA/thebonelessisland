import express from "express";
import { db } from "../db/client.js";
import { requireParentRole, requireSession } from "../lib/auth.js";
import { ingestNewsForApps } from "../lib/gameNewsIngestion.js";
import { getGuildId } from "../lib/serverSettings.js";
import { curateUncuratedNews, forceCurateNews } from "../lib/newsCurator.js";

export const gameNewsRouter = express.Router();
gameNewsRouter.use(requireSession);

type ScopeRow = {
  app_id: number;
  is_library: boolean;
  is_wishlist: boolean;
  is_crew: boolean;
};

async function resolveScopeAppIds(discordUserId: string): Promise<{
  byAppId: Map<number, { isLibrary: boolean; isWishlist: boolean; isCrew: boolean }>;
  topAppIds: number[];
}> {
  if (!getGuildId()) {
    return { byAppId: new Map(), topAppIds: [] };
  }

  const result = await db.query<ScopeRow>(
    `
      WITH me AS (
        SELECT id FROM users WHERE discord_user_id = $1
      ),
      crew_owned AS (
        SELECT ug.app_id
        FROM user_games ug
        INNER JOIN users u ON u.id = ug.user_id
        INNER JOIN guild_members gm
          ON gm.discord_user_id = u.discord_user_id
         AND gm.guild_id = $2
         AND gm.in_guild = TRUE
        GROUP BY ug.app_id
      ),
      crew_wishlist AS (
        SELECT uw.app_id
        FROM user_wishlists uw
        INNER JOIN users u ON u.id = uw.user_id
        INNER JOIN guild_members gm
          ON gm.discord_user_id = u.discord_user_id
         AND gm.guild_id = $2
         AND gm.in_guild = TRUE
        GROUP BY uw.app_id
      ),
      my_owned AS (
        SELECT ug.app_id FROM user_games ug INNER JOIN me ON me.id = ug.user_id
      ),
      my_wishlist AS (
        SELECT uw.app_id FROM user_wishlists uw INNER JOIN me ON me.id = uw.user_id
      ),
      crew_owner_counts AS (
        SELECT ug.app_id, COUNT(DISTINCT u.id)::int AS owners
        FROM user_games ug
        INNER JOIN users u ON u.id = ug.user_id
        INNER JOIN guild_members gm
          ON gm.discord_user_id = u.discord_user_id
         AND gm.guild_id = $2
         AND gm.in_guild = TRUE
        GROUP BY ug.app_id
      )
      SELECT
        all_apps.app_id,
        EXISTS (SELECT 1 FROM my_owned mo WHERE mo.app_id = all_apps.app_id) AS is_library,
        EXISTS (SELECT 1 FROM my_wishlist mw WHERE mw.app_id = all_apps.app_id) AS is_wishlist,
        EXISTS (SELECT 1 FROM crew_owned co WHERE co.app_id = all_apps.app_id) AS is_crew
      FROM (
        SELECT app_id FROM crew_owned
        UNION
        SELECT app_id FROM crew_wishlist
      ) AS all_apps
      ORDER BY all_apps.app_id
      LIMIT 500
    `,
    [discordUserId, getGuildId()]
  );

  const byAppId = new Map<number, { isLibrary: boolean; isWishlist: boolean; isCrew: boolean }>();
  for (const row of result.rows) {
    byAppId.set(row.app_id, {
      isLibrary: row.is_library,
      isWishlist: row.is_wishlist,
      isCrew: row.is_crew
    });
  }

  const ranked = await db.query<{ app_id: number }>(
    `
      SELECT g.app_id
      FROM games g
      LEFT JOIN (
        SELECT ug.app_id, COUNT(DISTINCT u.id)::int AS owners
        FROM user_games ug
        INNER JOIN users u ON u.id = ug.user_id
        INNER JOIN guild_members gm
          ON gm.discord_user_id = u.discord_user_id
         AND gm.guild_id = $2
         AND gm.in_guild = TRUE
        GROUP BY ug.app_id
      ) AS counts ON counts.app_id = g.app_id
      WHERE g.app_id = ANY($1::int[])
      ORDER BY COALESCE(counts.owners, 0) DESC, g.app_id ASC
      LIMIT 24
    `,
    [Array.from(byAppId.keys()), getGuildId()]
  );

  return { byAppId, topAppIds: ranked.rows.map((row) => row.app_id) };
}

type NewsRow = {
  app_id: number;
  game_name: string;
  header_image_url: string | null;
  gid: string;
  title: string;
  url: string;
  contents: string | null;
  feed_label: string | null;
  feed_name: string | null;
  feed_type: number | null;
  is_external_url: boolean;
  author: string | null;
  tags: string[];
  published_at: string;
  ai_relevance_score: number | null;
  ai_summary: string | null;
  ai_label: string | null;
  ai_spoiler_warning: boolean;
};

gameNewsRouter.get("/news", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const scope = await resolveScopeAppIds(discordUserId);
  const allAppIds = Array.from(scope.byAppId.keys());

  if (allAppIds.length === 0) {
    res.json({ news: [] });
    return;
  }

  await ingestNewsForApps(scope.topAppIds, { maxApps: 8 });

  // Fire-and-forget: curate any un-curated items in the background
  curateUncuratedNews(scope.topAppIds).catch((err) => {
    console.error("[gameNews] background curation error:", err);
  });

  const result = await db.query<NewsRow>(
    `
      SELECT
        n.app_id,
        g.name AS game_name,
        g.header_image_url,
        n.gid,
        n.title,
        n.url,
        n.contents,
        n.feed_label,
        n.feed_name,
        n.feed_type,
        n.is_external_url,
        n.author,
        n.tags,
        n.published_at,
        n.ai_relevance_score,
        n.ai_summary,
        n.ai_label,
        n.ai_spoiler_warning
      FROM game_news n
      INNER JOIN games g ON g.app_id = n.app_id
      WHERE n.app_id = ANY($1::int[])
      ORDER BY n.ai_relevance_score DESC NULLS LAST, n.published_at DESC
      LIMIT 60
    `,
    [allAppIds]
  );

  res.json({
    news: result.rows.map((row) => {
      const scopes = scope.byAppId.get(row.app_id);
      const tagSet: Array<"library" | "wishlist" | "crew"> = [];
      if (scopes?.isLibrary) tagSet.push("library");
      if (scopes?.isWishlist) tagSet.push("wishlist");
      if (scopes?.isCrew) tagSet.push("crew");
      return {
        appId: row.app_id,
        gameName: row.game_name,
        headerImageUrl: row.header_image_url,
        gid: row.gid,
        title: row.title,
        url: row.url,
        contents: row.contents,
        feedLabel: row.feed_label,
        feedName: row.feed_name,
        feedType: row.feed_type,
        isExternalUrl: row.is_external_url,
        author: row.author,
        tags: row.tags,
        publishedAt: row.published_at,
        scopes: tagSet,
        aiRelevanceScore: row.ai_relevance_score,
        aiSummary: row.ai_summary,
        aiLabel: row.ai_label as "personal" | "community" | "top_news" | null,
        aiSpoilerWarning: row.ai_spoiler_warning
      };
    })
  });
});

gameNewsRouter.post("/news/curate", requireParentRole, async (_req, res) => {
  const guildId = getGuildId();
  if (!guildId) {
    res.status(503).json({ error: "Guild not configured" });
    return;
  }

  // Resolve the top app IDs across the whole crew (same logic as news GET, but all crew)
  const ranked = await db.query<{ app_id: number }>(
    `
      SELECT g.app_id
      FROM games g
      INNER JOIN user_games ug ON ug.app_id = g.app_id
      INNER JOIN users u ON u.id = ug.user_id
      INNER JOIN guild_members gm ON gm.discord_user_id = u.discord_user_id AND gm.guild_id = $1 AND gm.in_guild = TRUE
      GROUP BY g.app_id
      ORDER BY COUNT(DISTINCT u.id) DESC
      LIMIT 24
    `,
    [guildId]
  );

  const appIds = ranked.rows.map((r) => r.app_id);
  const curated = await forceCurateNews(appIds);
  res.json({ ok: true, curated });
});
