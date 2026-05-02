import { db } from "../db/client.js";

type SteamNewsItem = {
  gid?: string;
  title?: string;
  url?: string;
  is_external_url?: boolean;
  author?: string;
  contents?: string;
  feedlabel?: string;
  feedname?: string;
  feed_type?: number;
  date?: number;
  tags?: string[];
};

type SteamNewsResponse = {
  appnews?: {
    appid?: number;
    newsitems?: SteamNewsItem[];
  };
};

const STEAM_NEWS_PER_APP = 6;
const STEAM_NEWS_MAXLENGTH = 400;

async function fetchSteamNewsForApp(appId: number): Promise<SteamNewsItem[]> {
  const url =
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/` +
    `?appid=${appId}&count=${STEAM_NEWS_PER_APP}&maxlength=${STEAM_NEWS_MAXLENGTH}&format=json`;
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) {
    return [];
  }
  const payload = (await response.json().catch(() => null)) as SteamNewsResponse | null;
  return payload?.appnews?.newsitems ?? [];
}

async function upsertNewsItems(appId: number, items: SteamNewsItem[]): Promise<void> {
  for (const item of items) {
    const gid = typeof item.gid === "string" ? item.gid.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    const date = typeof item.date === "number" ? item.date : 0;
    if (!gid || !title || !url || !date) {
      continue;
    }

    const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : [];

    await db.query(
      `
        INSERT INTO game_news (
          app_id,
          gid,
          title,
          url,
          contents,
          feed_label,
          feed_name,
          feed_type,
          is_external_url,
          author,
          tags,
          published_at,
          fetched_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], to_timestamp($12), NOW())
        ON CONFLICT (app_id, gid)
        DO UPDATE SET
          title = EXCLUDED.title,
          url = EXCLUDED.url,
          contents = EXCLUDED.contents,
          feed_label = EXCLUDED.feed_label,
          feed_name = EXCLUDED.feed_name,
          feed_type = EXCLUDED.feed_type,
          is_external_url = EXCLUDED.is_external_url,
          author = EXCLUDED.author,
          tags = EXCLUDED.tags,
          published_at = EXCLUDED.published_at,
          fetched_at = NOW()
      `,
      [
        appId,
        gid,
        title,
        url,
        item.contents ?? null,
        item.feedlabel ?? null,
        item.feedname ?? null,
        typeof item.feed_type === "number" ? item.feed_type : null,
        Boolean(item.is_external_url),
        item.author ?? null,
        tags,
        date
      ]
    );
  }
}

export async function ingestNewsForApps(
  appIds: number[],
  options: { staleAfterMs?: number; maxApps?: number } = {}
): Promise<{ ingestedApps: number; ingestedItems: number }> {
  const staleAfterMs = options.staleAfterMs ?? 6 * 60 * 60 * 1000;
  const maxApps = options.maxApps ?? 8;

  if (appIds.length === 0) {
    return { ingestedApps: 0, ingestedItems: 0 };
  }

  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const stale = await db.query<{ app_id: number }>(
    `
      SELECT app_id
      FROM games
      WHERE app_id = ANY($1::int[])
        AND (news_checked_at IS NULL OR news_checked_at < $2::timestamptz)
      ORDER BY news_checked_at NULLS FIRST, app_id ASC
      LIMIT $3::int
    `,
    [appIds, cutoff, maxApps]
  );

  let ingestedItems = 0;
  for (const row of stale.rows) {
    const items = await fetchSteamNewsForApp(row.app_id);
    if (items.length > 0) {
      await upsertNewsItems(row.app_id, items);
      ingestedItems += items.length;
    }
    await db.query(`UPDATE games SET news_checked_at = NOW() WHERE app_id = $1`, [row.app_id]);
  }

  return { ingestedApps: stale.rows.length, ingestedItems };
}
