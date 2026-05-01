import { env } from "../config.js";
import { db } from "../db/client.js";

export type GameImageProvider = "steam" | "cheapshark" | "igdb";
export const GAME_IMAGE_PROVIDER_PRIORITY: readonly GameImageProvider[] = ["steam", "cheapshark", "igdb"];

type SteamAppDetails = {
  success?: boolean;
  data?: {
    name?: string;
    developers?: string[];
    genres?: Array<{ description?: string }>;
    categories?: Array<{ description?: string }>;
    header_image?: string;
  };
};

type CheapSharkGameResult = {
  thumb?: string;
  external?: string;
  steamAppID?: string;
};
type IgdbTokenResponse = {
  access_token?: string;
  expires_in?: number;
};
type IgdbGameSearchResult = {
  cover?: number;
};
type IgdbCoverResult = {
  image_id?: string;
};
type GameImageCandidateContext = {
  appId: number;
  name: string;
};

let igdbAccessTokenCache: { token: string; expiresAtMs: number } | null = null;

async function markImageChecked(appId: number): Promise<void> {
  await db.query(
    `
      UPDATE games
      SET header_image_checked_at = NOW()
      WHERE app_id = $1
    `,
    [appId]
  );
}

async function fetchSteamAppDetails(appIds: number[]): Promise<Record<string, SteamAppDetails>> {
  if (!appIds.length) return {};
  const response = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${appIds.join(",")}&l=en&cc=us`
  ).catch(() => null);
  if (!response?.ok) {
    return {};
  }
  return (await response.json().catch(() => ({}))) as Record<string, SteamAppDetails>;
}

async function resolveSteamImageMap(appIds: number[]): Promise<Map<number, string>> {
  const detailsByAppId = await fetchSteamAppDetails(appIds);
  const imageMap = new Map<number, string>();
  for (const appId of appIds) {
    const headerImage = detailsByAppId[String(appId)]?.data?.header_image?.trim();
    if (headerImage) {
      imageMap.set(appId, headerImage);
    }
  }
  return imageMap;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCheapSharkCandidate(candidate: CheapSharkGameResult, gameName: string, appId: number): number {
  const normalizedTarget = normalizeForMatch(gameName);
  const normalizedExternal = normalizeForMatch(candidate.external ?? "");
  const targetWords = normalizedTarget.split(" ").filter(Boolean);
  const externalWords = new Set(normalizedExternal.split(" ").filter(Boolean));

  let score = 0;
  if (candidate.steamAppID && Number(candidate.steamAppID) === appId) {
    score += 1000;
  }
  if (normalizedExternal === normalizedTarget) {
    score += 500;
  } else if (
    normalizedExternal.length > 0 &&
    normalizedTarget.length > 0 &&
    (normalizedExternal.includes(normalizedTarget) || normalizedTarget.includes(normalizedExternal))
  ) {
    score += 250;
  }
  for (const word of targetWords) {
    if (externalWords.has(word)) {
      score += 20;
    }
  }
  return score;
}

async function resolveCheapSharkImage(context: GameImageCandidateContext): Promise<string | null> {
  const rawName = context.name.trim();
  const normalizedName = normalizeForMatch(rawName);
  const attempts = Array.from(new Set([rawName, normalizedName].filter((value) => value.length > 0)));

  const candidates: CheapSharkGameResult[] = [];
  for (const term of attempts) {
    const searchUrl = `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(term)}&limit=25&exact=0`;
    const response = await fetch(searchUrl).catch(() => null);
    if (!response?.ok) {
      continue;
    }
    const payload = (await response.json().catch(() => [])) as CheapSharkGameResult[];
    candidates.push(...payload);
  }

  const withImages = candidates.filter((item) => Boolean(item.thumb?.trim()));
  if (!withImages.length) {
    return null;
  }

  let best: CheapSharkGameResult | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of withImages) {
    const score = scoreCheapSharkCandidate(candidate, context.name, context.appId);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best?.thumb?.trim() ?? null;
}

async function getIgdbAccessToken(): Promise<string | null> {
  if (!env.IGDB_IMAGE_FALLBACK_ENABLED) {
    return null;
  }
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) {
    return null;
  }

  const now = Date.now();
  if (igdbAccessTokenCache && igdbAccessTokenCache.expiresAtMs > now + 15_000) {
    return igdbAccessTokenCache.token;
  }

  const body = new URLSearchParams({
    client_id: env.IGDB_CLIENT_ID,
    client_secret: env.IGDB_CLIENT_SECRET,
    grant_type: "client_credentials"
  });
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as IgdbTokenResponse | null;
  const accessToken = payload?.access_token?.trim();
  const expiresIn = payload?.expires_in ?? 0;
  if (!accessToken || expiresIn <= 0) {
    return null;
  }

  igdbAccessTokenCache = {
    token: accessToken,
    expiresAtMs: now + expiresIn * 1000
  };
  return accessToken;
}

async function resolveIgdbImageByName(gameName: string): Promise<string | null> {
  const accessToken = await getIgdbAccessToken();
  if (!accessToken) {
    return null;
  }

  const gameSearchQuery = [`search "${gameName.replaceAll('"', '\\"')}";`, "fields cover;", "limit 1;"].join(" ");
  const gamesResponse = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "text/plain"
    },
    body: gameSearchQuery
  }).catch(() => null);
  if (!gamesResponse?.ok) {
    return null;
  }

  const gamePayload = (await gamesResponse.json().catch(() => [])) as IgdbGameSearchResult[];
  const coverId = gamePayload[0]?.cover;
  if (!coverId) {
    return null;
  }

  const coverQuery = [`where id = ${coverId};`, "fields image_id;", "limit 1;"].join(" ");
  const coversResponse = await fetch("https://api.igdb.com/v4/covers", {
    method: "POST",
    headers: {
      "Client-ID": env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "text/plain"
    },
    body: coverQuery
  }).catch(() => null);
  if (!coversResponse?.ok) {
    return null;
  }

  const coverPayload = (await coversResponse.json().catch(() => [])) as IgdbCoverResult[];
  const imageId = coverPayload[0]?.image_id?.trim();
  if (!imageId) {
    return null;
  }
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function isProviderEnabled(provider: GameImageProvider): boolean {
  if (provider === "igdb") {
    return env.IGDB_IMAGE_FALLBACK_ENABLED && Boolean(env.IGDB_CLIENT_ID) && Boolean(env.IGDB_CLIENT_SECRET);
  }
  return true;
}

export async function enrichGameMetadataFromSteam(appIds: number[]): Promise<void> {
  if (!appIds.length) return;

  const payload = await fetchSteamAppDetails(appIds);
  for (const appId of appIds) {
    const appData = payload[String(appId)];
    if (!appData?.success || !appData.data) {
      continue;
    }

    const developers = (appData.data.developers ?? []).filter(Boolean);
    const genreTags = (appData.data.genres ?? []).map((x) => x.description?.trim() ?? "").filter(Boolean);
    const categoryTags = (appData.data.categories ?? []).map((x) => x.description?.trim() ?? "").filter(Boolean);
    const tags = Array.from(new Set([...genreTags, ...categoryTags]));
    const hasSteamImage = Boolean(appData.data.header_image?.trim());

    await db.query(
      `
        UPDATE games
        SET
          name = COALESCE(NULLIF($2, ''), name),
          developers = $3::text[],
          tags = $4::text[],
          header_image_url = COALESCE(NULLIF($5, ''), header_image_url),
          header_image_provider = CASE
            WHEN NULLIF($5, '') IS NOT NULL THEN 'steam'
            ELSE header_image_provider
          END,
          metadata_updated_at = NOW(),
          header_image_checked_at = CASE
            WHEN $6::boolean THEN NOW()
            ELSE header_image_checked_at
          END
        WHERE app_id = $1
      `,
      [appId, appData.data.name ?? "", developers, tags, appData.data.header_image ?? "", hasSteamImage]
    );
  }
}

export async function enrichMissingGameImages(appIds: number[]): Promise<void> {
  if (!appIds.length) return;

  const games = await db.query<{ app_id: number; name: string; header_image_url: string | null }>(
    `
      SELECT app_id, name, header_image_url
      FROM games
      WHERE app_id = ANY($1::int[])
    `,
    [appIds]
  );

  const steamImageMap = GAME_IMAGE_PROVIDER_PRIORITY.includes("steam")
    ? await resolveSteamImageMap(games.rows.map((game) => game.app_id))
    : new Map<number, string>();

  const resolveImageForProvider = async (
    provider: GameImageProvider,
    context: GameImageCandidateContext
  ): Promise<string | null> => {
    if (provider === "steam") {
      return steamImageMap.get(context.appId) ?? null;
    }
    if (provider === "cheapshark") {
      return resolveCheapSharkImage(context);
    }
    if (provider === "igdb") {
      return resolveIgdbImageByName(context.name);
    }
    return null;
  };

  for (const game of games.rows) {
    if (game.header_image_url) {
      continue;
    }

    let resolvedProvider: GameImageProvider | null = null;
    let resolvedUrl: string | null = null;
    for (const provider of GAME_IMAGE_PROVIDER_PRIORITY) {
      if (!isProviderEnabled(provider)) {
        continue;
      }
      const candidate = await resolveImageForProvider(provider, { appId: game.app_id, name: game.name });
      if (candidate) {
        resolvedProvider = provider;
        resolvedUrl = candidate;
        break;
      }
    }

    if (resolvedUrl && resolvedProvider) {
      await db.query(
        `
          UPDATE games
          SET
            header_image_url = $2,
            header_image_provider = $3,
            metadata_updated_at = NOW(),
            header_image_checked_at = NOW()
          WHERE app_id = $1
            AND (header_image_url IS NULL OR header_image_url = '')
        `,
        [game.app_id, resolvedUrl, resolvedProvider]
      );
      continue;
    }

    await markImageChecked(game.app_id);
  }
}
