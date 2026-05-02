import Parser from "rss-parser";
import { db } from "../db/client.js";
import { AIDisabledError, AINotConfiguredError, getAIProvider } from "./ai/index.js";
import { getAISetting } from "./serverSettings.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedItem = {
  sourceType: "rss" | "newsapi";
  sourceName: string;
  externalId: string; // dedup key — usually the article URL
  title: string;
  url: string;
  contents: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  matchedTags: string[];
};

type GeneralCurationResult = {
  id: string; // external_id
  relevanceScore: number;
  label: "top_news" | "community" | "personal";
  spoilerWarning: boolean;
  summary: string;
  duplicate?: boolean;
};

// ── RSS Feed Catalogue ─────────────────────────────────────────────────────────

const RSS_FEEDS: Record<string, { name: string; url: string }> = {
  pcgamer: {
    name: "PC Gamer",
    url: "https://www.pcgamer.com/rss/"
  },
  rockpapershotgun: {
    name: "Rock Paper Shotgun",
    url: "https://www.rockpapershotgun.com/feed"
  },
  eurogamer: {
    name: "Eurogamer",
    url: "https://www.eurogamer.net/?format=rss"
  },
  kotaku: {
    name: "Kotaku",
    url: "https://kotaku.com/rss"
  },
  ign: {
    name: "IGN",
    url: "https://feeds.feedburner.com/ign/games-all"
  }
};

// Per-feed recent item cap — avoid flooding on first run
const ITEMS_PER_FEED = 15;
// Max articles to AI-curate per ingestion run
const CURATION_BATCH_SIZE = 20;

let ingestionInFlight = false;

const rssParser = new Parser({
  timeout: 10_000,
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
      ["enclosure", "enclosure"]
    ]
  }
});

// ── Tag Matching ──────────────────────────────────────────────────────────────

/** Fetch crew game tags (genres, categories) weighted by ownership + playtime. */
async function getCrewGameTags(): Promise<string[]> {
  const result = await db.query<{ tag: string }>(
    `
      SELECT LOWER(TRIM(t)) AS tag, COUNT(DISTINCT ug.user_id) AS owners
      FROM user_games ug
      INNER JOIN games g ON g.app_id = ug.app_id,
      UNNEST(g.tags) AS t
      GROUP BY LOWER(TRIM(t))
      HAVING COUNT(DISTINCT ug.user_id) >= 1
      ORDER BY owners DESC
      LIMIT 60
    `
  );
  return result.rows.map((r) => r.tag);
}

function matchTagsToArticle(title: string, contents: string | null, crewTags: string[]): string[] {
  const haystack = `${title} ${contents ?? ""}`.toLowerCase();
  return crewTags.filter((tag) => haystack.includes(tag));
}

// ── RSS Ingestion ─────────────────────────────────────────────────────────────

async function fetchRssFeed(key: string, crewTags: string[]): Promise<FeedItem[]> {
  const feed = RSS_FEEDS[key];
  if (!feed) return [];

  try {
    const parsed = await rssParser.parseURL(feed.url);
    const items = (parsed.items ?? []).slice(0, ITEMS_PER_FEED);

    return items
      .filter((item) => !!item.link && !!item.title)
      .map((item) => {
        const url = item.link!;
        const title = item.title!;
        const contents = item.contentSnippet ?? item.content ?? null;
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

        // Try to extract image from various RSS fields
        const imageUrl: string | null =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item as any).mediaThumbnail?.["$"]?.url ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item as any).mediaContent?.["$"]?.url ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item as any).enclosure?.url ??
          null;

        return {
          sourceType: "rss" as const,
          sourceName: feed.name,
          externalId: url,
          title,
          url,
          contents,
          author: item.creator ?? null,
          imageUrl,
          publishedAt,
          matchedTags: matchTagsToArticle(title, contents, crewTags)
        };
      });
  } catch (err) {
    console.warn(`[generalNews] RSS fetch failed for ${key}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ── GNews API Ingestion ───────────────────────────────────────────────────────

async function fetchGNewsArticles(crewTags: string[]): Promise<FeedItem[]> {
  const apiKey = getAISetting("newsapi_key");
  if (!apiKey || apiKey === "••••••••") return [];

  // Build a search query from the most-relevant crew game tags
  const topTags = crewTags.slice(0, 8).join(" OR ");
  if (!topTags) return [];

  const query = `(${topTags}) gaming`;
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&topic=technology&max=10&apikey=${apiKey}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      console.warn(`[generalNews] GNews API error ${resp.status}: ${await resp.text()}`);
      return [];
    }

    const data = (await resp.json()) as {
      articles?: Array<{
        title: string;
        url: string;
        description: string | null;
        content: string | null;
        publishedAt: string;
        source: { name: string };
        image: string | null;
        author: string | null;
      }>;
    };

    return (data.articles ?? []).map((a) => ({
      sourceType: "newsapi" as const,
      sourceName: a.source.name,
      externalId: a.url,
      title: a.title,
      url: a.url,
      contents: a.content ?? a.description ?? null,
      author: a.author,
      imageUrl: a.image,
      publishedAt: new Date(a.publishedAt),
      matchedTags: matchTagsToArticle(a.title, a.content ?? a.description, crewTags)
    }));
  } catch (err) {
    console.warn(`[generalNews] GNews fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ── DB Upsert ─────────────────────────────────────────────────────────────────

async function upsertGeneralNews(items: FeedItem[]): Promise<number[]> {
  if (items.length === 0) return [];

  const insertedIds: number[] = [];

  for (const item of items) {
    try {
      const result = await db.query<{ id: number }>(
        `
          INSERT INTO general_news
            (source_type, source_name, external_id, title, url, contents, author,
             image_url, published_at, matched_tags)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (source_type, external_id) DO NOTHING
          RETURNING id
        `,
        [
          item.sourceType,
          item.sourceName,
          item.externalId,
          item.title,
          item.url,
          item.contents,
          item.author,
          item.imageUrl,
          item.publishedAt.toISOString(),
          item.matchedTags
        ]
      );
      if (result.rows[0]) {
        insertedIds.push(result.rows[0].id);
      }
    } catch (err) {
      console.error("[generalNews] upsert failed for", item.externalId, err);
    }
  }

  return insertedIds;
}

// ── AI Curation for General News ─────────────────────────────────────────────

type RawGeneral = {
  id: number;
  external_id: string;
  title: string;
  contents: string | null;
  source_name: string;
  matched_tags: string[];
};

async function buildCrewContext(): Promise<string> {
  const [recent, topOwned] = await Promise.all([
    db.query<{ game_name: string; playtime_2weeks: number }>(
      `SELECT g.name AS game_name, SUM(ug.playtime_2weeks)::int AS playtime_2weeks
       FROM user_games ug
       INNER JOIN games g ON g.app_id = ug.app_id
       WHERE ug.playtime_2weeks > 0
       GROUP BY g.name
       ORDER BY playtime_2weeks DESC
       LIMIT 8`
    ),
    db.query<{ game_name: string; owners: number; tags: string[] }>(
      `SELECT g.name AS game_name, COUNT(DISTINCT ug.user_id)::int AS owners, g.tags
       FROM user_games ug
       INNER JOIN games g ON g.app_id = ug.app_id
       GROUP BY g.name, g.tags
       ORDER BY owners DESC
       LIMIT 12`
    )
  ]);

  const recentStr = recent.rows
    .map((r) => `${r.game_name}(${Math.round((r.playtime_2weeks / 60) * 10) / 10}h)`)
    .join(", ");

  const ownedStr = topOwned.rows.map((r) => `${r.game_name}(${r.owners} owners)`).join(", ");

  const tagFreq: Record<string, number> = {};
  for (const row of topOwned.rows) {
    for (const tag of row.tags ?? []) {
      tagFreq[tag] = (tagFreq[tag] ?? 0) + row.owners;
    }
  }
  const topTagsStr = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t]) => t)
    .join(", ");

  return `Playing this week: ${recentStr || "none"}
Top owned games: ${ownedStr || "none"}
Crew genre tags: ${topTagsStr || "none"}`;
}

async function curateGeneralNewsBatch(
  items: RawGeneral[],
  crewContext: string
): Promise<GeneralCurationResult[]> {
  const ai = getAIProvider();

  const payload = items.map((it) => ({
    id: it.external_id,
    source: it.source_name,
    title: it.title,
    excerpt: it.contents ? it.contents.slice(0, 220) + (it.contents.length > 220 ? "…" : "") : ""
  }));

  const systemPrompt = `# Role

You are a gaming news curator for The Boneless Island — a tight-knit Discord gaming community of adult gamers in their 30s. You're a fellow gamer: direct, knowledgeable, low-fluff.

# Task

Curate a batch of general gaming news articles from external outlets (RSS feeds and news APIs). Score each for relevance to this crew based on their game library and playtime data.

# Labels
- \`top_news\`: Breaking / high-impact industry news regardless of crew relevance (studio closures, major releases, acquisitions, major controversies)
- \`community\`: Trending gaming news that matches crew genre interests but not specific games they own
- \`personal\`: Directly about games or series the crew actively plays (check Crew genre tags + top owned games in context)

# Output format

Return a JSON array — one object per input article, in the same order.

[
  {
    "id": "<string — must match input id exactly>",
    "relevanceScore": <number 0.0–1.0>,
    "label": "<top_news | community | personal>",
    "spoilerWarning": <true | false>,
    "summary": "<2–3 sentence casual gamer summary>",
    "duplicate": <true | false>
  }
]

Relevance 0.75–1.0 = major impact / crew relevance; 0.4–0.74 = notable; 0–0.39 = low signal.
Mark \`duplicate: true\` for articles covering the same event as a higher-quality piece in this batch.
Return ONLY the JSON array.`;

  const userContent = `## Crew context\n\n${crewContext}\n\n## Articles\n\n${JSON.stringify(payload, null, 2)}`;

  const result = await ai.complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    { maxTokens: 3072 }
  );

  const raw = result.text.trim();
  const jsonText = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : raw;
  const parsed = JSON.parse(jsonText) as GeneralCurationResult[];
  if (!Array.isArray(parsed)) throw new Error("AI returned non-array response");
  return parsed;
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Fetch general gaming news from enabled RSS feeds + optional GNews API,
 * then AI-curate any un-curated rows.
 * Safe to call fire-and-forget — all errors are caught internally.
 */
export async function ingestAndCurateGeneralNews(): Promise<{ fetched: number; curated: number }> {
  const enabled = getAISetting("news_general_enabled");
  if (enabled === "false") return { fetched: 0, curated: 0 };
  if (ingestionInFlight) return { fetched: 0, curated: 0 };
  ingestionInFlight = true;

  let totalFetched = 0;
  let totalCurated = 0;

  try {
    const crewTags = await getCrewGameTags();

    // Determine which RSS sources are enabled
    const rawSources = getAISetting("news_rss_sources") ?? "pcgamer,rockpapershotgun,eurogamer,kotaku";
    const enabledSources = rawSources
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Fetch all sources concurrently
    const rssFetches = enabledSources.map((key) => fetchRssFeed(key, crewTags));
    const gNewsFetch = fetchGNewsArticles(crewTags);

    const allResults = await Promise.all([...rssFetches, gNewsFetch]);
    const allItems = allResults.flat();

    const insertedIds = await upsertGeneralNews(allItems);
    totalFetched = insertedIds.length;

    // Curate new rows
    const uncurated = await db.query<RawGeneral>(
      `
        SELECT id, external_id, title, contents, source_name, matched_tags
        FROM general_news
        WHERE ai_curated_at IS NULL
        ORDER BY published_at DESC
        LIMIT $1
      `,
      [CURATION_BATCH_SIZE]
    );

    if (uncurated.rows.length > 0) {
      try {
        const crewContext = await buildCrewContext();
        const results = await curateGeneralNewsBatch(uncurated.rows, crewContext);

        for (const res of results) {
          const row = uncurated.rows.find((r) => r.external_id === res.id);
          if (!row) continue;

          if (res.duplicate) {
            await db.query(
              `UPDATE general_news SET ai_relevance_score = 0, ai_curated_at = NOW() WHERE id = $1`,
              [row.id]
            );
          } else {
            await db.query(
              `UPDATE general_news
               SET ai_relevance_score = $1,
                   ai_summary         = $2,
                   ai_label           = $3,
                   ai_spoiler_warning = $4,
                   ai_curated_at      = NOW()
               WHERE id = $5`,
              [res.relevanceScore, res.summary, res.label, res.spoilerWarning ?? false, row.id]
            );
            totalCurated++;
          }
        }
      } catch (err) {
        if (err instanceof AIDisabledError || err instanceof AINotConfiguredError) {
          console.warn("[generalNews] AI unavailable, skipping curation:", err.message);
        } else {
          console.error("[generalNews] Curation error:", err);
        }
      }
    }
  } catch (err) {
    console.error("[generalNews] Ingestion error:", err);
  } finally {
    ingestionInFlight = false;
  }

  return { fetched: totalFetched, curated: totalCurated };
}

/**
 * Manually trigger AI curation of any un-curated general_news rows.
 * Used by the admin "trigger curation" button.
 */
export async function curateUncuratedGeneralNews(): Promise<number> {
  const uncurated = await db.query<RawGeneral>(
    `
      SELECT id, external_id, title, contents, source_name, matched_tags
      FROM general_news
      WHERE ai_curated_at IS NULL
      ORDER BY published_at DESC
      LIMIT $1
    `,
    [CURATION_BATCH_SIZE]
  );

  if (uncurated.rows.length === 0) return 0;

  try {
    const crewContext = await buildCrewContext();
    const results = await curateGeneralNewsBatch(uncurated.rows, crewContext);
    let count = 0;

    for (const res of results) {
      const row = uncurated.rows.find((r) => r.external_id === res.id);
      if (!row) continue;

      if (res.duplicate) {
        await db.query(
          `UPDATE general_news SET ai_relevance_score = 0, ai_curated_at = NOW() WHERE id = $1`,
          [row.id]
        );
      } else {
        await db.query(
          `UPDATE general_news
           SET ai_relevance_score = $1, ai_summary = $2, ai_label = $3,
               ai_spoiler_warning = $4, ai_curated_at = NOW()
           WHERE id = $5`,
          [res.relevanceScore, res.summary, res.label, res.spoilerWarning ?? false, row.id]
        );
        count++;
      }
    }
    return count;
  } catch (err) {
    console.error("[generalNews] Manual curation error:", err);
    return 0;
  }
}
