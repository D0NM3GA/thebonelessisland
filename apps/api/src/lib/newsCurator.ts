import { db } from "../db/client.js";
import { AIDisabledError, AINotConfiguredError, getAIProvider } from "./ai/index.js";

type RawNewsItem = {
  app_id: number;
  gid: string;
  title: string;
  contents: string | null;
  game_name: string;
  tags: string[];
};

type CurationResult = {
  gid: string;
  relevanceScore: number;
  summary: string;
  label?: "personal" | "community" | "top_news";
  spoilerWarning?: boolean;
  duplicate?: boolean; // true = merged into another story; skip DB write
};

// Larger batch amortises the fixed cost of the long system prompt over more articles.
const BATCH_SIZE = 20;
// Prevent two concurrent page loads from firing duplicate curation batches.
let curationInFlight = false;

function truncate(text: string | null, maxChars: number): string {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

async function callAIForCuration(
  items: RawNewsItem[],
  crewContext: string
): Promise<CurationResult[]> {
  const ai = getAIProvider();

  const itemsPayload = items.map((item) => ({
    gid: item.gid,
    game: item.game_name,
    title: item.title,
    excerpt: truncate(item.contents, 200)
  }));

  const systemPrompt = `# Role

You are a gaming news curator for The Boneless Island — a tight-knit Discord gaming community of adult gamers in their 30s. You're a fellow gamer who knows what's actually worth sharing: deep knowledge of game metadata, news deduplication, and community personalization. Casual and conversational tone — no fluff, no duplicates, no spoilers without warnings.

# Task

For each batch of articles, curate a gaming news feed by cross-referencing the provided community context and aggregating multi-source coverage into clean, single summaries.

# Available signals

**Community signals (provided in the user message):**
- Games the crew has been playing most this week (with playtime hours)
- Top games owned across the crew library
- Game genres and tags popular in the community

**Editorial signals you must apply independently:**
- Breaking or high-impact gaming news (major releases, studio closures, significant patches, controversies, industry events) surfaces regardless of crew relevance — label \`"top_news"\`
- Stories about games the crew is actively playing — label \`"personal"\`
- Trending stories not tied to crew games — label \`"community"\`

# Deduplication

**Story identity:** Two articles cover the same event when they share the same named entities (game title, studio, publisher) AND the same event type (announcement, patch release, controversy, acquisition, etc.) AND occurred within the same news cycle. If all three align, mark the lower-quality duplicate with \`"duplicate": true\` — the higher-quality source absorbs it.

**Distinct angles are NOT duplicates:** A patch release and player backlash to that patch are separate stories. A studio announcement and a subsequent controversy about it are separate stories. If a follow-up article introduces a new event type, it is its own card.

**Source quality tiers when picking the primary:**
1. First-party sources (official developer/publisher posts, press releases)
2. Major editorial outlets with editorial standards
3. Secondary outlets and aggregators
4. Social posts and user-generated content

# Output format

Return a JSON array — one object per input article. Every input \`gid\` must appear exactly once.

[
  {
    "gid": "<string — must match input exactly>",
    "relevanceScore": <number 0.0–1.0>,
    "label": "<personal | community | top_news>",
    "spoilerWarning": <true | false>,
    "summary": "<2–3 sentences, casual gamer tone, factual>",
    "duplicate": <true | false>
  }
]

**Relevance score guide:**
- 0.75–1.0: Major gameplay impact — new content, significant patch, DLC/expansion, new game mode, major controversy with player-facing consequence
- 0.40–0.74: Notable but secondary — minor patch with meaningful fixes, community event, cosmetic update, industry news
- 0.00–0.39: Low signal — server maintenance, sponsored/PR fluff, no gameplay impact

**Summary rules:**
- Write like you're telling a gamer friend — casual, direct, no hedging language
- Be specific: what happened, who it affects, what changes for players
- 2–3 sentences max
- If coverage is still developing and sources are thin, say so rather than padding with assumptions
- Never speculate or editorialize beyond what the source material says

**Spoiler handling:**
- If an article contains plot details, story twists, or ending information for a story-driven game, set \`"spoilerWarning": true\`
- Do NOT reveal the spoiler in the summary — write around it: e.g. "This update addresses late-game story content — spoilers ahead if you haven't finished"

**Hard constraints:**
- No duplicate stories under any framing
- No speculation presented as fact
- No promotional or sponsored content surfaced as organic news
- Every input gid must appear exactly once in the output`;

  const userContent = `## Community context

${crewContext}

## News articles to curate

${JSON.stringify(itemsPayload, null, 2)}

Return ONLY the JSON array. No markdown fences, no explanation.`;

  const result = await ai.complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    { maxTokens: 3072 }
  );

  const raw = result.text.trim();
  // Strip potential markdown code fences
  const jsonText = raw.startsWith("```") ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : raw;
  const parsed = JSON.parse(jsonText) as CurationResult[];

  if (!Array.isArray(parsed)) throw new Error("AI returned non-array response");
  return parsed;
}

/**
 * Curates un-curated game_news rows for the given app IDs using the active AI provider.
 * Safe to call in a fire-and-forget context — catches and logs errors internally.
 * Returns the number of articles successfully curated.
 */
export async function curateUncuratedNews(appIds: number[]): Promise<number> {
  if (appIds.length === 0) return 0;
  if (curationInFlight) return 0; // another batch is already running
  curationInFlight = true;

  // Fetch un-curated items for these apps, newest first
  const result = await db.query<RawNewsItem>(
    `
      SELECT n.app_id, n.gid, n.title, n.contents, g.name AS game_name, g.tags
      FROM game_news n
      INNER JOIN games g ON g.app_id = n.app_id
      WHERE n.app_id = ANY($1::int[])
        AND n.ai_curated_at IS NULL
      ORDER BY n.published_at DESC
      LIMIT $2
    `,
    [appIds, BATCH_SIZE]
  );

  if (result.rows.length === 0) {
    curationInFlight = false;
    return 0;
  }

  try {
    // Build compact crew context — tokens matter here, it goes in every curation call
    const [recentlyPlayedResult, topOwnedResult] = await Promise.all([
      db.query<{ game_name: string; playtime_2weeks: number }>(
        `SELECT g.name AS game_name, SUM(ug.playtime_2weeks)::int AS playtime_2weeks
         FROM user_games ug
         INNER JOIN games g ON g.app_id = ug.app_id
         WHERE ug.playtime_2weeks > 0
         GROUP BY g.name
         ORDER BY playtime_2weeks DESC
         LIMIT 8`
      ),
      db.query<{ game_name: string; owners: number }>(
        `SELECT g.name AS game_name, COUNT(DISTINCT ug.user_id)::int AS owners
         FROM user_games ug
         INNER JOIN games g ON g.app_id = ug.app_id
         GROUP BY g.name
         ORDER BY owners DESC
         LIMIT 10`
      )
    ]);

    // Compact format — "Game A(8h) Game B(3h)" instead of verbose sentences
    const recentStr = recentlyPlayedResult.rows
      .map((r) => `${r.game_name}(${Math.round((r.playtime_2weeks / 60) * 10) / 10}h)`)
      .join(" ");

    const ownedStr = topOwnedResult.rows
      .map((r) => `${r.game_name}(${r.owners})`)
      .join(" ");

    const allTags = result.rows.flatMap((r) => r.tags);
    const topTags = [...new Set(allTags)].slice(0, 10).join(", ");

    const crewContext = [
      recentStr ? `Played this week: ${recentStr}` : null,
      ownedStr ? `Top owned(count): ${ownedStr}` : null,
      topTags ? `Tags: ${topTags}` : null
    ]
      .filter(Boolean)
      .join("\n");

    let curated: CurationResult[] = [];
    try {
      curated = await callAIForCuration(result.rows, crewContext);
    } catch (err) {
      if (err instanceof AIDisabledError || err instanceof AINotConfiguredError) {
        return 0;
      }
      console.error("[newsCurator] AI curation failed:", err);
      return 0;
    }

    const VALID_LABELS = new Set(["personal", "community", "top_news"]);

    // Write results back; skip items the AI flagged as duplicate (absorbed by a better source)
    let count = 0;
    for (const item of curated) {
      if (!item.gid) continue;
      if (item.duplicate) {
        // Mark as curated with score 0 so it doesn't re-enter the un-curated queue
        await db.query(
          `UPDATE game_news SET ai_relevance_score = 0, ai_summary = NULL, ai_curated_at = NOW() WHERE gid = $1`,
          [item.gid]
        );
        continue;
      }

      const score = Math.min(1, Math.max(0, item.relevanceScore ?? 0));
      const summary = (item.summary ?? "").trim().slice(0, 800);
      const label = VALID_LABELS.has(item.label ?? "") ? item.label! : null;
      const spoilerWarning = item.spoilerWarning === true;

      await db.query(
        `
          UPDATE game_news
          SET ai_relevance_score  = $1,
              ai_summary          = $2,
              ai_label            = $3,
              ai_spoiler_warning  = $4,
              ai_curated_at       = NOW()
          WHERE gid = $5
        `,
        [score, summary, label, spoilerWarning, item.gid]
      );
      count++;
    }

    return count;
  } finally {
    curationInFlight = false;
  }
}

/**
 * Re-curates all items for the given apps, including already-curated ones.
 * Intended for the admin "Re-curate News" action.
 */
export async function forceCurateNews(appIds: number[]): Promise<number> {
  if (appIds.length === 0) return 0;

  // Reset curation status so curateUncuratedNews picks them up
  await db.query(
    `UPDATE game_news SET ai_curated_at = NULL WHERE app_id = ANY($1::int[])`,
    [appIds]
  );

  return curateUncuratedNews(appIds);
}
