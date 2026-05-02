import express from "express";
import { z } from "zod";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { recordEvent } from "../lib/activityEvents.js";
import { requireSession } from "../lib/auth.js";
import { enrichGameMetadataFromSteam, enrichMissingGameImages } from "../lib/gameCatalogEnrichment.js";
import { getGuildId } from "../lib/serverSettings.js";

const linkSchema = z.object({
  steamId64: z.string().min(10)
});

export const steamRouter = express.Router();

const STEAM_OPENID_PATHS = new Set(["/openid/start", "/openid/return"]);

steamRouter.use((req, res, next) => {
  if (STEAM_OPENID_PATHS.has(req.path)) {
    next();
    return;
  }
  requireSession(req, res, next);
});

type SteamWishlistItem = {
  appid: number;
  priority: number;
  dateAdded: number | null;
};

type SyncWishlistResult =
  | { ok: true; syncedItems: number }
  | { ok: false; status: number | null; reason: string };

async function fetchSteamWishlistItems(steamId64: string): Promise<{
  ok: boolean;
  status: number | null;
  items: SteamWishlistItem[];
  reason?: string;
}> {
  if (!env.STEAM_WEB_API_KEY) {
    return { ok: false, status: null, items: [], reason: "Missing STEAM_WEB_API_KEY in environment" };
  }

  const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=${env.STEAM_WEB_API_KEY}&steamid=${steamId64}`;
  const response = await fetch(url).catch(() => null);
  if (!response) {
    return { ok: false, status: null, items: [], reason: "Steam wishlist request failed" };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, items: [], reason: `Steam wishlist request returned ${response.status}` };
  }

  const data = (await response.json().catch(() => null)) as
    | { response?: { items?: Array<{ appid?: number; priority?: number; date_added?: number }> } }
    | null;

  const rawItems = data?.response?.items ?? [];
  const items: SteamWishlistItem[] = rawItems
    .map((item) => ({
      appid: typeof item.appid === "number" ? item.appid : 0,
      priority: typeof item.priority === "number" ? item.priority : 0,
      dateAdded: typeof item.date_added === "number" ? item.date_added : null
    }))
    .filter((item) => item.appid > 0);

  return { ok: true, status: 200, items };
}

async function syncWishlistForUser(userId: string, steamId64: string): Promise<SyncWishlistResult> {
  const fetched = await fetchSteamWishlistItems(steamId64);
  if (!fetched.ok) {
    return { ok: false, status: fetched.status, reason: fetched.reason ?? "Wishlist sync failed" };
  }

  const items = fetched.items;
  const appIds = items.map((item) => item.appid);

  if (appIds.length > 0) {
    await db.query(
      `
        INSERT INTO games (app_id, name)
        SELECT t.appid, 'app-' || t.appid::text
        FROM UNNEST($1::int[]) AS t(appid)
        ON CONFLICT (app_id) DO NOTHING
      `,
      [appIds]
    );

    // Bulk upsert: build parallel value arrays and pass as typed arrays
    const wishlistUserIds = items.map(() => userId);
    const wishlistAppIds = items.map((i) => i.appid);
    const wishlistPriorities = items.map((i) => i.priority);
    const wishlistAddedAts = items.map((i) =>
      i.dateAdded ? new Date(i.dateAdded * 1000).toISOString() : null
    );

    await db.query(
      `
        INSERT INTO user_wishlists (user_id, app_id, priority, added_at, synced_at)
        SELECT
          u::bigint,
          a::int,
          p::int,
          d::timestamptz,
          NOW()
        FROM
          UNNEST($1::text[], $2::int[], $3::int[], $4::text[]) AS t(u, a, p, d)
        ON CONFLICT (user_id, app_id)
        DO UPDATE SET
          priority   = EXCLUDED.priority,
          added_at   = EXCLUDED.added_at,
          synced_at  = NOW()
      `,
      [wishlistUserIds, wishlistAppIds, wishlistPriorities, wishlistAddedAts]
    );

    await db.query(
      `DELETE FROM user_wishlists WHERE user_id = $1 AND app_id <> ALL($2::int[])`,
      [userId, appIds]
    );

    // Enrich all wishlist items that are missing metadata or an image.
    // Steam's appdetails endpoint supports batches; we chunk at 50 to stay
    // well within unofficial limits and avoid overly long query strings.
    const enrichTargets = await db.query<{ app_id: number }>(
      `
        SELECT app_id
        FROM games
        WHERE app_id = ANY($1::int[])
          AND (metadata_updated_at IS NULL OR header_image_url IS NULL)
        ORDER BY app_id ASC
      `,
      [appIds]
    );
    const enrichIds = enrichTargets.rows.map((row) => row.app_id);
    for (let i = 0; i < enrichIds.length; i += 50) {
      const chunk = enrichIds.slice(i, i + 50);
      await enrichGameMetadataFromSteam(chunk);
      await enrichMissingGameImages(chunk);
    }
  } else {
    await db.query(`DELETE FROM user_wishlists WHERE user_id = $1`, [userId]);
  }

  return { ok: true, syncedItems: items.length };
}

steamRouter.post("/link", async (req, res) => {
  const { steamId64 } = linkSchema.parse(req.body);
  const discordUserId = String(res.locals.userId);
  await db.query(
    `
      INSERT INTO steam_links (user_id, steam_id64)
      SELECT id, $2 FROM users WHERE discord_user_id = $1
      ON CONFLICT (user_id)
      DO UPDATE SET steam_id64 = EXCLUDED.steam_id64, linked_at = NOW()
    `,
    [discordUserId, steamId64]
  );
  void recordEvent({ eventType: "steam.linked", actorDiscordUserId: discordUserId });
  res.json({ ok: true });
});

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const STEAM_CLAIMED_ID_REGEX = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

function apiBaseUrlFromRequest(req: express.Request): string {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get("host");
  return `${protocol}://${host}`;
}

steamRouter.get("/openid/start", (req, res) => {
  if (!req.session?.userId) {
    res.redirect(buildWebRedirect("error", "not_authenticated"));
    return;
  }
  const apiBase = apiBaseUrlFromRequest(req);
  const returnTo = `${apiBase}/steam/openid/return`;
  const realm = apiBase;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
  });
  res.redirect(`${STEAM_OPENID_ENDPOINT}?${params.toString()}`);
});

async function verifySteamOpenIdAssertion(query: Record<string, unknown>): Promise<{ steamId64: string } | { error: string }> {
  const verifyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      verifyParams.append(key, value);
    } else if (Array.isArray(value)) {
      verifyParams.append(key, String(value[0] ?? ""));
    }
  }
  verifyParams.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString()
  }).catch(() => null);

  if (!response?.ok) {
    return { error: "Steam openid verification request failed" };
  }

  const body = await response.text();
  if (!/is_valid\s*:\s*true/i.test(body)) {
    return { error: "Steam openid assertion was not valid" };
  }

  const claimedId =
    typeof query["openid.claimed_id"] === "string"
      ? (query["openid.claimed_id"] as string)
      : typeof query["openid.identity"] === "string"
        ? (query["openid.identity"] as string)
        : "";

  const match = claimedId.match(STEAM_CLAIMED_ID_REGEX);
  if (!match) {
    return { error: "Steam openid response did not contain a SteamID64" };
  }
  return { steamId64: match[1] };
}

function buildWebRedirect(status: "linked" | "error", reason?: string): string {
  const url = new URL(env.WEB_ORIGIN);
  url.searchParams.set("steam", status);
  if (reason) {
    url.searchParams.set("steamReason", reason);
  }
  return url.toString();
}

steamRouter.get("/openid/return", async (req, res) => {
  if (!req.session?.userId) {
    res.redirect(buildWebRedirect("error", "not_authenticated"));
    return;
  }
  const discordUserId = String(req.session.userId);
  const mode = typeof req.query["openid.mode"] === "string" ? req.query["openid.mode"] : "";

  if (mode !== "id_res") {
    res.redirect(buildWebRedirect("error", mode === "cancel" ? "cancelled" : "invalid_mode"));
    return;
  }

  const verification = await verifySteamOpenIdAssertion(req.query as Record<string, unknown>);
  if ("error" in verification) {
    res.redirect(buildWebRedirect("error", "verification_failed"));
    return;
  }

  await db.query(
    `
      INSERT INTO steam_links (user_id, steam_id64)
      SELECT id, $2 FROM users WHERE discord_user_id = $1
      ON CONFLICT (user_id)
      DO UPDATE SET steam_id64 = EXCLUDED.steam_id64, linked_at = NOW()
    `,
    [discordUserId, verification.steamId64]
  );

  void recordEvent({
    eventType: "steam.linked",
    actorDiscordUserId: discordUserId,
    payload: { via: "openid" }
  });

  res.redirect(buildWebRedirect("linked"));
});

steamRouter.post("/unlink", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  await db.query(
    `DELETE FROM steam_links WHERE user_id = (SELECT id FROM users WHERE discord_user_id = $1)`,
    [discordUserId]
  );
  void recordEvent({ eventType: "steam.unlinked", actorDiscordUserId: discordUserId });
  res.json({ ok: true });
});

steamRouter.post("/sync-owned-games", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const link = await db.query<{ user_id: string; steam_id64: string }>(
    `
      SELECT sl.user_id, sl.steam_id64
      FROM steam_links sl
      INNER JOIN users u ON u.id = sl.user_id
      WHERE u.discord_user_id = $1
    `,
    [discordUserId]
  );
  if (!link.rows[0]) {
    res.status(400).json({ error: "No Steam account linked" });
    return;
  }

  if (!env.STEAM_WEB_API_KEY) {
    res.status(400).json({ error: "Missing STEAM_WEB_API_KEY in environment" });
    return;
  }

  try {
    const apiUrl =
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/" +
      `?key=${env.STEAM_WEB_API_KEY}&steamid=${link.rows[0].steam_id64}&include_appinfo=1`;
    const steamResponse = await fetch(apiUrl);

    if (!steamResponse.ok) {
      res.status(502).json({ error: "Steam API request failed" });
      return;
    }

    const steamJson = (await steamResponse.json()) as {
      response?: { games?: Array<{ appid: number; name: string; playtime_forever?: number }> };
    };

    if (!steamJson.response) {
      res.status(502).json({ error: "Steam API response format was invalid" });
      return;
    }

    const games = steamJson.response.games ?? [];
    for (const game of games) {
      await db.query(
        `
          INSERT INTO games (app_id, name)
          VALUES ($1, $2)
          ON CONFLICT (app_id) DO UPDATE SET name = EXCLUDED.name
        `,
        [game.appid, game.name]
      );
      await db.query(
        `
          INSERT INTO user_games (user_id, app_id, playtime_minutes)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, app_id)
          DO UPDATE SET playtime_minutes = EXCLUDED.playtime_minutes, last_played_at = NOW()
        `,
        [link.rows[0].user_id, game.appid, game.playtime_forever ?? 0]
      );
    }

    await db.query(`UPDATE steam_links SET last_synced_at = NOW() WHERE user_id = $1`, [link.rows[0].user_id]);

    const wishlistResult = await syncWishlistForUser(link.rows[0].user_id, link.rows[0].steam_id64).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Wishlist sync threw during sync-owned-games:", msg, error);
      return { ok: false, status: null, reason: msg } as SyncWishlistResult;
    });

    void recordEvent({
      eventType: "steam.synced",
      actorDiscordUserId: discordUserId,
      payload: {
        syncedGames: games.length,
        wishlistItems: wishlistResult.ok ? wishlistResult.syncedItems : 0,
        wishlistOk: wishlistResult.ok
      }
    });

    res.json({
      syncedGames: games.length,
      wishlist: wishlistResult.ok
        ? { ok: true, syncedItems: wishlistResult.syncedItems }
        : { ok: false, status: wishlistResult.status, reason: wishlistResult.reason }
    });
  } catch (error) {
    console.error("Steam sync failed", error);
    res.status(502).json({ error: "Unable to sync Steam games right now" });
  }
});

steamRouter.post("/sync-wishlist", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const link = await db.query<{ user_id: string; steam_id64: string }>(
    `
      SELECT sl.user_id, sl.steam_id64
      FROM steam_links sl
      INNER JOIN users u ON u.id = sl.user_id
      WHERE u.discord_user_id = $1
    `,
    [discordUserId]
  );
  if (!link.rows[0]) {
    res.status(400).json({ error: "No Steam account linked" });
    return;
  }

  if (!env.STEAM_WEB_API_KEY) {
    res.status(400).json({ error: "Missing STEAM_WEB_API_KEY in environment" });
    return;
  }

  try {
    const result = await syncWishlistForUser(link.rows[0].user_id, link.rows[0].steam_id64);
    if (!result.ok) {
      res.status(502).json({ error: result.reason, status: result.status });
      return;
    }
    res.json({ syncedItems: result.syncedItems });
  } catch (error) {
    console.error("Wishlist sync failed", error);
    res.status(502).json({ error: "Unable to sync Steam wishlist right now" });
  }
});

steamRouter.get("/my-games", async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const result = await db.query<{ app_id: number; name: string }>(
    `
      SELECT g.app_id, g.name
      FROM users u
      INNER JOIN user_games ug ON ug.user_id = u.id
      INNER JOIN games g ON g.app_id = ug.app_id
      WHERE u.discord_user_id = $1
      ORDER BY g.name ASC
      LIMIT 5000
    `,
    [discordUserId]
  );

  res.json({
    games: result.rows.map((row) => ({
      appId: row.app_id,
      name: row.name
    }))
  });
});

type CrewGameOwnerJson = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

type CrewGameRow = {
  app_id: number;
  name: string;
  max_players: number;
  median_session_minutes: number;
  developers: string[];
  tags: string[];
  header_image_url: string | null;
  owner_count: number;
  owners: CrewGameOwnerJson[];
};

steamRouter.get("/crew-games", async (req, res) => {
  if (!getGuildId()) {
    res.status(400).json({ error: "DISCORD_GUILD_ID is not configured" });
    return;
  }

  const minOwnersRaw = Number(req.query.minOwners);
  const minOwners = Number.isInteger(minOwnersRaw) && minOwnersRaw > 0 ? minOwnersRaw : 1;

  const baseQuery = async (): Promise<CrewGameRow[]> => {
    const result = await db.query<CrewGameRow>(
      `
        SELECT
          g.app_id,
          g.name,
          g.max_players,
          g.median_session_minutes,
          g.developers,
          g.tags,
          g.header_image_url,
          COUNT(DISTINCT u.id)::int AS owner_count,
          COALESCE(
            JSON_AGG(
              JSONB_BUILD_OBJECT(
                'discordUserId', u.discord_user_id,
                'displayName', COALESCE(gm.display_name, gm.username, dp.username),
                'avatarUrl', COALESCE(gm.avatar_url, dp.avatar_url)
              )
              ORDER BY COALESCE(gm.display_name, gm.username, dp.username) ASC
            ),
            '[]'::json
          ) AS owners
        FROM user_games ug
        INNER JOIN games g ON g.app_id = ug.app_id
        INNER JOIN users u ON u.id = ug.user_id
        INNER JOIN guild_members gm
          ON gm.discord_user_id = u.discord_user_id
         AND gm.guild_id = $1
         AND gm.in_guild = TRUE
        LEFT JOIN discord_profiles dp ON dp.user_id = u.id
        GROUP BY
          g.app_id,
          g.name,
          g.max_players,
          g.median_session_minutes,
          g.developers,
          g.tags,
          g.header_image_url
        HAVING COUNT(DISTINCT u.id) >= $2::int
        ORDER BY owner_count DESC, g.name ASC
        LIMIT 1000
      `,
      [getGuildId(), minOwners]
    );
    return result.rows;
  };

  let rows = await baseQuery();

  const missingMetadataIds = rows
    .filter((row) => row.developers.length === 0 && row.tags.length === 0)
    .slice(0, 50)
    .map((row) => row.app_id);
  const missingImageIds = rows
    .filter((row) => !row.header_image_url)
    .slice(0, 50)
    .map((row) => row.app_id);

  await Promise.all([
    enrichGameMetadataFromSteam(missingMetadataIds),
    enrichMissingGameImages(missingImageIds)
  ]);

  if (missingMetadataIds.length || missingImageIds.length) {
    rows = await baseQuery();
  }

  res.json({
    games: rows.map((row) => ({
      appId: row.app_id,
      name: row.name,
      maxPlayers: row.max_players,
      medianSessionMinutes: row.median_session_minutes,
      developers: row.developers,
      tags: row.tags,
      headerImageUrl: row.header_image_url,
      ownerCount: row.owner_count,
      owners: row.owners
    }))
  });
});

type CrewWishlistRow = {
  app_id: number;
  name: string;
  max_players: number;
  median_session_minutes: number;
  developers: string[];
  tags: string[];
  header_image_url: string | null;
  hype_count: number;
  earliest_added_at: string | null;
  wishlisted_by: CrewGameOwnerJson[];
};

steamRouter.get("/crew-wishlist", async (req, res) => {
  if (!getGuildId()) {
    res.status(400).json({ error: "DISCORD_GUILD_ID is not configured" });
    return;
  }

  const minHypeRaw = Number(req.query.minHype);
  const minHype = Number.isInteger(minHypeRaw) && minHypeRaw > 0 ? minHypeRaw : 1;

  const baseQuery = async (): Promise<CrewWishlistRow[]> => {
    const result = await db.query<CrewWishlistRow>(
      `
        SELECT
          g.app_id,
          g.name,
          g.max_players,
          g.median_session_minutes,
          g.developers,
          g.tags,
          g.header_image_url,
          COUNT(DISTINCT u.id)::int AS hype_count,
          MIN(uw.added_at) AS earliest_added_at,
          COALESCE(
            JSON_AGG(
              JSONB_BUILD_OBJECT(
                'discordUserId', u.discord_user_id,
                'displayName', COALESCE(gm.display_name, gm.username, dp.username),
                'avatarUrl', COALESCE(gm.avatar_url, dp.avatar_url)
              )
              ORDER BY COALESCE(gm.display_name, gm.username, dp.username) ASC
            ),
            '[]'::json
          ) AS wishlisted_by
        FROM user_wishlists uw
        INNER JOIN games g ON g.app_id = uw.app_id
        INNER JOIN users u ON u.id = uw.user_id
        INNER JOIN guild_members gm
          ON gm.discord_user_id = u.discord_user_id
         AND gm.guild_id = $1
         AND gm.in_guild = TRUE
        LEFT JOIN discord_profiles dp ON dp.user_id = u.id
        GROUP BY
          g.app_id,
          g.name,
          g.max_players,
          g.median_session_minutes,
          g.developers,
          g.tags,
          g.header_image_url
        HAVING COUNT(DISTINCT u.id) >= $2::int
        ORDER BY hype_count DESC, earliest_added_at ASC NULLS LAST, g.name ASC
        LIMIT 200
      `,
      [getGuildId(), minHype]
    );
    return result.rows;
  };

  let rows = await baseQuery();

  const missingMetadataIds = rows
    .filter((row) => row.developers.length === 0 && row.tags.length === 0)
    .slice(0, 50)
    .map((row) => row.app_id);
  const missingImageIds = rows
    .filter((row) => !row.header_image_url)
    .slice(0, 50)
    .map((row) => row.app_id);

  await Promise.all([
    enrichGameMetadataFromSteam(missingMetadataIds),
    enrichMissingGameImages(missingImageIds)
  ]);

  if (missingMetadataIds.length || missingImageIds.length) {
    rows = await baseQuery();
  }

  res.json({
    games: rows.map((row) => ({
      appId: row.app_id,
      name: row.name,
      maxPlayers: row.max_players,
      medianSessionMinutes: row.median_session_minutes,
      developers: row.developers,
      tags: row.tags,
      headerImageUrl: row.header_image_url,
      hypeCount: row.hype_count,
      earliestAddedAt: row.earliest_added_at,
      wishlistedBy: row.wishlisted_by
    }))
  });
});
