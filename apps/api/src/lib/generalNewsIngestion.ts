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
  subtitle: string;
  tags: string[];
  gameTitle: string | null;
  whyRecommended: string | null;
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
  },
  polygon: {
    name: "Polygon",
    url: "https://www.polygon.com/rss/index.xml"
  },
  vg247: {
    name: "VG247",
    url: "https://www.vg247.com/feed"
  },
  pcgamesn: {
    name: "PCGamesN",
    url: "https://www.pcgamesn.com/mainrss.xml"
  },
  theverge: {
    name: "The Verge",
    url: "https://www.theverge.com/rss/gaming/index.xml"
  },
  gamesradar: {
    name: "GamesRadar",
    url: "https://www.gamesradar.com/rss/"
  }
};

// Outlet names that must never appear as AI-generated tags
const OUTLET_TAG_BLOCKLIST = new Set(
  Object.values(RSS_FEEDS).map((f) => f.name.toLowerCase())
);

/** Strip outlet names and blank entries from AI-generated tags. */
function sanitizeTags(tags: string[]): string[] {
  const result = tags.filter((t) => {
    const lower = t.trim().toLowerCase();
    const blocked = OUTLET_TAG_BLOCKLIST.has(lower);
    if (blocked) console.log(`[generalNews] sanitizeTags: blocked "${t}"`);
    return lower.length > 0 && !blocked;
  });
  console.log(`[generalNews] sanitizeTags: input=[${tags.join("|")}] → output=[${result.join("|")}]`);
  return result;
}

// Per-feed recent item cap — avoid flooding on first run
const ITEMS_PER_FEED = 20;
// Max articles to AI-curate per curation pass — larger = more cross-source story coverage
const CURATION_BATCH_SIZE = 25;

let ingestionInFlight = false;
let lastIngestedAt = 0;
const INGEST_COOLDOWN_MS = 60 * 60 * 1000;

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

/** Fetch crew game tags (genres, categories) weighted by ownership. Requires 2+ owners. */
async function getCrewGameTags(): Promise<string[]> {
  const result = await db.query<{ tag: string }>(
    `
      SELECT LOWER(TRIM(t)) AS tag, COUNT(DISTINCT ug.user_id) AS owners
      FROM user_games ug
      INNER JOIN games g ON g.app_id = ug.app_id,
      UNNEST(g.tags) AS t
      GROUP BY LOWER(TRIM(t))
      HAVING COUNT(DISTINCT ug.user_id) >= 2
      ORDER BY owners DESC
      LIMIT 60
    `
  );
  return result.rows.map((r) => r.tag);
}

/** Fetch distinct game names owned by any crew member. */
async function getCrewGameNames(): Promise<string[]> {
  const result = await db.query<{ name: string }>(
    `
      SELECT DISTINCT LOWER(g.name) AS name
      FROM user_games ug
      INNER JOIN games g ON g.app_id = ug.app_id
    `
  );
  return result.rows.map((r) => r.name);
}

function matchTagsToArticle(
  title: string,
  contents: string | null,
  crewTags: string[],
  gameNames: string[]
): string[] {
  const haystack = `${title} ${contents ?? ""}`.toLowerCase();
  const tagMatches = crewTags.filter((tag) => haystack.includes(tag));
  const gameMatches = gameNames.filter((name) => haystack.includes(name));
  return [...new Set([...tagMatches, ...gameMatches])];
}

// ── RSS Ingestion ─────────────────────────────────────────────────────────────

async function fetchRssFeed(key: string, crewTags: string[], gameNames: string[]): Promise<FeedItem[]> {
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
          matchedTags: matchTagsToArticle(title, contents, crewTags, gameNames)
        };
      });
  } catch (err) {
    console.warn(`[generalNews] RSS fetch failed for ${key}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ── GNews API Ingestion ───────────────────────────────────────────────────────

async function fetchGNewsArticles(crewTags: string[], gameNames: string[]): Promise<FeedItem[]> {
  const apiKey = getAISetting("newsapi_key");
  if (!apiKey || apiKey === "••••••••") {
    console.log("[generalNews] GNews skipped: newsapi_key not configured in admin settings");
    return [];
  }

  // Broad gaming news query — let AI filter relevance, not the query
  const query = "video games gaming";
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&sortby=publishedAt&apikey=${apiKey}`;

  console.log("[generalNews] Fetching GNews...");

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[generalNews] GNews API error ${resp.status}: ${body}`);
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

    const articles = data.articles ?? [];
    console.log(`[generalNews] GNews returned ${articles.length} articles`);

    return articles.map((a) => ({
      sourceType: "newsapi" as const,
      sourceName: a.source.name,
      externalId: a.url,
      title: a.title,
      url: a.url,
      contents: a.content ?? a.description ?? null,
      author: a.author,
      imageUrl: a.image,
      publishedAt: new Date(a.publishedAt),
      matchedTags: matchTagsToArticle(a.title, a.content ?? a.description, crewTags, gameNames)
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
  const [recent, topOwned, tagFeedback, crewEntities] = await Promise.all([
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
    ),
    db.query<{ tag: string; net_score: number }>(
      `SELECT UNNEST(gn.ai_tags) AS tag,
              SUM(CASE WHEN gnf.rating = 1 THEN 1.0 ELSE -0.5 END) AS net_score
       FROM general_news_feedback gnf
       JOIN general_news gn ON gn.id = gnf.news_id
       WHERE gnf.created_at > NOW() - INTERVAL '30 days'
         AND array_length(gn.ai_tags, 1) > 0
       GROUP BY tag
       HAVING ABS(SUM(CASE WHEN gnf.rating = 1 THEN 1.0 ELSE -0.5 END)) >= 0.5
       ORDER BY net_score DESC`
    ),
    db.query<{ name: string; developers: string[] }>(
      `SELECT g.name, g.developers
       FROM user_games ug
       INNER JOIN games g ON g.app_id = ug.app_id
       GROUP BY g.name, g.developers
       ORDER BY COUNT(DISTINCT ug.user_id) DESC, SUM(ug.playtime_minutes) DESC
       LIMIT 20`
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

  const likedTags = tagFeedback.rows.filter((r) => r.net_score > 0).map((r) => r.tag).slice(0, 8);
  const dislikedTags = tagFeedback.rows.filter((r) => r.net_score < 0).map((r) => r.tag).slice(0, 5);

  const gameNames = crewEntities.rows.map((r) => r.name).join(", ");
  const studioNames = [...new Set(crewEntities.rows.flatMap((r) => r.developers ?? []))]
    .slice(0, 15)
    .join(", ");

  return [
    `Playing this week: ${recentStr || "none"}`,
    `Top owned games: ${ownedStr || "none"}`,
    `Crew genre tags: ${topTagsStr || "none"}`,
    likedTags.length > 0 ? `Crew has upvoted articles about: ${likedTags.join(", ")}` : "",
    dislikedTags.length > 0 ? `Crew has downvoted articles about: ${dislikedTags.join(", ")}` : "",
    "",
    `Crew Pick tags (use as Crew Pick tag when article is directly about them):`,
    `Games: ${gameNames || "none"}`,
    `Studios: ${studioNames || "none"}`
  ]
    .filter((line) => line !== "")
    .join("\n");
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
    excerpt: it.contents ? it.contents.slice(0, 800) + (it.contents.length > 800 ? "…" : "") : ""
  }));

  const systemPrompt = `# Role

You are a gaming news curator for The Boneless Island — a tight-knit Discord gaming community of adult gamers in their 30s. You're a fellow gamer: direct, knowledgeable, low-fluff.

# Task

Curate a batch of general gaming news articles from external outlets (RSS feeds and news APIs). Score each for relevance to this crew based on their game library and playtime data.

# Labels
- \`top_news\`: Breaking / high-impact industry news regardless of crew relevance (studio closures, major releases, acquisitions, major controversies)
- \`community\`: Trending gaming news that matches crew genre interests but not specific games they own
- \`personal\`: Directly about games or series the crew actively plays (check Crew genre tags + top owned games in context)

# Multi-source synthesis — CRITICAL

This batch deliberately includes articles from multiple outlets. Your primary job is cross-source synthesis, not single-article summarization.

**Step 1 — Identify story clusters:** Scan all articles and group them by story (same game, announcement, or event). A story may be covered by 2–6 different outlets in this batch.

**Step 2 — For each story cluster:**
- Pick the best-sourced article as the primary (most detail, most authoritative outlet)
- Mark all others as \`duplicate: true\` with a populated \`subtitle\` but empty \`summary\`
- For the PRIMARY: read every article in the cluster and synthesize ALL unique information — quotes, numbers, dates, features, developer comments, reactions — into a single comprehensive write-up that is richer than any individual source

**Step 3 — For truly unique articles** (no related articles in this batch): summarize that single source. A single-source summary is acceptable only when no other article in the batch covers the same story.

# Summary guidelines

Write a cross-source synthesis covering:
1. **What happened** — the core news fact, announcement, or event
2. **Context** — why it matters, background on the game/studio/situation
3. **Details** — specific numbers, dates, features, changes, or quotes drawn from EVERY source covering this story
4. **Crew angle** — how this affects or interests this gaming community (omit if not applicable)
5. **What's next** — expected follow-up, release date, or open questions

Aim for 150–300 words. Direct, conversational gamer tone — informative but not dry. Flowing prose, no bullet points. Don't start with "This article" or restate the title. Set to empty string \`""\` for duplicates.

# Tag taxonomy

BEFORE generating output, determine the correct tags for each article using ONLY these categories. Never use outlet or publication names — they are never tags.

**Content Type** (always exactly 1 — pick the best fit):
News · Patch Notes · Announcement · Review · Preview · Opinion · Interview · Feature · Rumor

**Genre** (0–1, the game's primary genre; omit if article is industry/hardware/esports news with no dominant genre):
FPS · RPG · Strategy · Horror · Platformer · Survival · Battle Royale · MOBA · Racing · Puzzle · Fighting · Sim · MMO

**Platform** (0–2, only when article is specifically about or exclusive to a platform):
PC · PlayStation · Xbox · Nintendo · Mobile · VR

**Crew Pick** (0–1, only when article is directly about a specific game or studio from crew context):
Use exact game and studio names from the "Crew Pick tags" section of the crew context.

NEVER use: PC Gamer, Kotaku, IGN, Rock Paper Shotgun, Eurogamer, Polygon, VG247, PCGamesN, The Verge, GamesRadar, or any other outlet name as a tag.

Examples:
- Studio closure article (no specific game): ["News"]
- Hades 2 patch from PC Gamer: ["Patch Notes", "RPG", "PC"]
- Marathon reveal trailer: ["Announcement", "FPS"]
- Nintendo Direct recap: ["Announcement", "Nintendo"]

# Output format

Return a JSON array — one object per input article, in the same order.

[
  {
    "id": "<string — must match input id exactly>",
    "relevanceScore": <number 0.0–1.0>,
    "label": "<top_news | community | personal>",
    "spoilerWarning": <true | false>,
    "summary": "<150–300 word multi-source synthesis; empty string for duplicates>",
    "subtitle": "<one sharp subheadline sentence, 10–20 words; always include, even for duplicates>",
    "tags": ["News", "RPG"],
    "gameTitle": "<primary game title e.g. 'Elden Ring'; null if no single game focus>",
    "whyRecommended": "<one sentence on crew relevance, or null>",
    "duplicate": <true | false>
  }
]

Relevance: 0.75–1.0 = major impact / crew relevance; 0.4–0.74 = notable; 0–0.39 = low signal.

Return ONLY the JSON array.`;

  const userContent = `## Crew context\n\n${crewContext}\n\n## Articles\n\n${JSON.stringify(payload, null, 2)}`;

  const result = await ai.complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    { maxTokens: 8192 }
  );

  const raw = result.text.trim();
  const jsonText = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : raw;
  const parsed = JSON.parse(jsonText) as GeneralCurationResult[];
  if (!Array.isArray(parsed)) throw new Error("AI returned non-array response");
  // Debug: log raw tags so we can verify taxonomy compliance
  const sample = parsed.slice(0, 3).map((r) => ({ id: r.id.slice(-30), tags: r.tags, dup: r.duplicate }));
  console.log("[generalNews] AI tag sample:", JSON.stringify(sample));
  return parsed;
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Fetch general gaming news from enabled RSS feeds + optional GNews API,
 * then AI-curate any un-curated rows.
 * Safe to call fire-and-forget — all errors are caught internally.
 */
export async function ingestAndCurateGeneralNews(force = false): Promise<{ fetched: number; curated: number }> {
  const enabled = getAISetting("news_general_enabled");
  if (enabled === "false") return { fetched: 0, curated: 0 };
  if (ingestionInFlight) return { fetched: 0, curated: 0 };
  if (!force && Date.now() - lastIngestedAt < INGEST_COOLDOWN_MS) return { fetched: 0, curated: 0 };
  ingestionInFlight = true;

  let totalFetched = 0;
  let totalCurated = 0;

  try {
    const [crewTags, gameNames] = await Promise.all([getCrewGameTags(), getCrewGameNames()]);

    // Determine which RSS sources are enabled
    const rawSources = getAISetting("news_rss_sources") ?? "pcgamer,rockpapershotgun,eurogamer,kotaku";
    const enabledSources = rawSources
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Fetch all sources concurrently
    const rssFetches = enabledSources.map((key) => fetchRssFeed(key, crewTags, gameNames));
    const gNewsFetch = fetchGNewsArticles(crewTags, gameNames);

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
               SET ai_relevance_score  = $1,
                   ai_summary          = $2,
                   ai_label            = $3,
                   ai_spoiler_warning  = $4,
                   ai_subtitle         = $5,
                   ai_tags             = $6,
                   ai_why_recommended  = $7,
                   ai_game_title       = $8,
                   ai_curated_at       = NOW()
               WHERE id = $9`,
              [res.relevanceScore, res.summary, res.label, res.spoilerWarning ?? false,
               res.subtitle || null, sanitizeTags(res.tags ?? []), res.whyRecommended ?? null,
               res.gameTitle ?? null, row.id]
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
    lastIngestedAt = Date.now();
    ingestionInFlight = false;
  }

  return { fetched: totalFetched, curated: totalCurated };
}

/**
 * Reset all existing curation data so rows will be re-processed by the next curation pass.
 * Used when the curation prompt changes and summaries need to be regenerated.
 */
export async function resetAllCuration(): Promise<number> {
  const result = await db.query<{ count: string }>(
    `UPDATE general_news SET ai_curated_at = NULL RETURNING id`
  );
  return result.rowCount ?? 0;
}

/**
 * Debug helper — run AI curation on a single article and return the raw AI result.
 * Useful for diagnosing tag taxonomy compliance without writing to DB.
 */
export async function debugCurateOne(): Promise<{
  article: RawGeneral | null;
  rawAiResult: GeneralCurationResult | null;
  sanitizedTags: string[];
  error?: string;
}> {
  const row = await db.query<RawGeneral>(
    `SELECT id, external_id, title, contents, source_name, matched_tags
     FROM general_news
     ORDER BY published_at DESC
     LIMIT 1`
  );
  const article = row.rows[0] ?? null;
  if (!article) return { article: null, rawAiResult: null, sanitizedTags: [] };

  try {
    const crewContext = await buildCrewContext();
    const results = await curateGeneralNewsBatch([article], crewContext);
    const raw = results[0] ?? null;
    return {
      article,
      rawAiResult: raw,
      sanitizedTags: raw ? sanitizeTags(raw.tags ?? []) : []
    };
  } catch (err) {
    return {
      article,
      rawAiResult: null,
      sanitizedTags: [],
      error: String(err)
    };
  }
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
        const tags = sanitizeTags(res.tags ?? []);
        console.log(`[generalNews] curate saving tags for ${row.id}: [${tags.join("|")}]`);
        await db.query(
          `UPDATE general_news
           SET ai_relevance_score  = $1,
               ai_summary          = $2,
               ai_label            = $3,
               ai_spoiler_warning  = $4,
               ai_subtitle         = $5,
               ai_tags             = $6,
               ai_why_recommended  = $7,
               ai_game_title       = $8,
               ai_curated_at       = NOW()
           WHERE id = $9`,
          [res.relevanceScore, res.summary, res.label, res.spoilerWarning ?? false,
           res.subtitle || null, tags, res.whyRecommended ?? null,
           res.gameTitle ?? null, row.id]
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
