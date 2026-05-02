import express from "express";
import { z } from "zod";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { getGuildId } from "../lib/serverSettings.js";
import { enrichGameMetadataFromSteam, enrichMissingGameImages } from "../lib/gameCatalogEnrichment.js";
import { whatCanWePlay } from "../lib/recommend.js";
import { generateRecommendationBlurb } from "../lib/recommendBlurb.js";

const requestSchema = z.object({
  memberIds: z.array(z.string()).min(1),
  sessionLength: z.enum(["short", "long", "any"]).default("any"),
  maxGroupSize: z.number().int().positive().default(8)
});

export const recommendationRouter = express.Router();

function canAccessRecommendations(req: express.Request): boolean {
  if (Boolean(req.session?.userId)) {
    return true;
  }

  const botSecret = req.get("x-island-bot-secret");
  return Boolean(env.BOT_API_SHARED_SECRET) && botSecret === env.BOT_API_SHARED_SECRET;
}

recommendationRouter.post("/what-can-we-play", async (req, res) => {
  if (!canAccessRecommendations(req)) {
    res.status(401).json({ error: "Not authorized to access recommendations" });
    return;
  }

  const input = requestSchema.parse(req.body);
  const recommendations = await whatCanWePlay(input);

  // Attach an AI blurb to the top pick (fire-and-forget style — await but swallow errors)
  let topBlurb: string | null = null;
  if (recommendations[0]) {
    topBlurb = await generateRecommendationBlurb(recommendations[0], input.memberIds.length).catch(() => null);
  }

  const enriched = recommendations.map((r, i) => ({
    ...r,
    blurb: i === 0 ? (topBlurb ?? r.reason) : r.reason
  }));

  res.json({ recommendations: enriched });
});

type FeaturedScope = "voice" | "crew";

async function resolveFeaturedScope(requestedScope: FeaturedScope): Promise<{
  memberIds: string[];
  resolvedScope: FeaturedScope;
}> {
  if (!getGuildId()) {
    return { memberIds: [], resolvedScope: requestedScope };
  }

  if (requestedScope === "voice") {
    const voice = await db.query<{ discord_user_id: string }>(
      `
        SELECT discord_user_id
        FROM guild_members
        WHERE guild_id = $1 AND in_guild = TRUE AND in_voice = TRUE
        ORDER BY username ASC
        LIMIT 32
      `,
      [getGuildId()]
    );
    if (voice.rows.length > 0) {
      return { memberIds: voice.rows.map((row) => row.discord_user_id), resolvedScope: "voice" };
    }
  }

  const crew = await db.query<{ discord_user_id: string }>(
    `
      SELECT discord_user_id
      FROM guild_members
      WHERE guild_id = $1 AND in_guild = TRUE
      ORDER BY username ASC
      LIMIT 64
    `,
    [getGuildId()]
  );
  return { memberIds: crew.rows.map((row) => row.discord_user_id), resolvedScope: "crew" };
}

recommendationRouter.get("/featured", async (req, res) => {
  if (!canAccessRecommendations(req)) {
    res.status(401).json({ error: "Not authorized to access recommendations" });
    return;
  }

  const requestedScope: FeaturedScope = req.query.scope === "voice" ? "voice" : "crew";
  const { memberIds, resolvedScope } = await resolveFeaturedScope(requestedScope);

  if (memberIds.length === 0) {
    res.json({ featured: null, scope: resolvedScope, scopeMemberCount: 0 });
    return;
  }

  const recs = await whatCanWePlay({
    memberIds,
    sessionLength: "any",
    maxGroupSize: memberIds.length
  });
  const top = recs[0];
  if (!top) {
    res.json({ featured: null, scope: resolvedScope, scopeMemberCount: memberIds.length });
    return;
  }

  await enrichGameMetadataFromSteam([top.appId]);
  await enrichMissingGameImages([top.appId]);

  const meta = await db.query<{
    header_image_url: string | null;
    tags: string[];
    max_players: number;
    median_session_minutes: number;
  }>(
    `SELECT header_image_url, tags, max_players, median_session_minutes FROM games WHERE app_id = $1`,
    [top.appId]
  );
  const metaRow = meta.rows[0];

  const blurb = await generateRecommendationBlurb(top, memberIds.length).catch(() => null);

  res.json({
    featured: {
      appId: top.appId,
      name: top.name,
      owners: top.owners,
      scopeMemberCount: memberIds.length,
      score: top.score,
      reason: blurb ?? top.reason,
      headerImageUrl: metaRow?.header_image_url ?? null,
      tags: metaRow?.tags ?? [],
      maxPlayers: metaRow?.max_players ?? null,
      medianSessionMinutes: metaRow?.median_session_minutes ?? null
    },
    scope: resolvedScope,
    scopeMemberCount: memberIds.length
  });
});
