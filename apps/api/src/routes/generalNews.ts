import { Router } from "express";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";
import { ingestAndCurateGeneralNews, curateUncuratedGeneralNews, resetAllCuration } from "../lib/generalNewsIngestion.js";

export const generalNewsRouter = Router();

type GeneralNewsRow = {
  id: number;
  source_type: string;
  source_name: string;
  external_id: string;
  title: string;
  url: string;
  contents: string | null;
  author: string | null;
  image_url: string | null;
  published_at: string;
  matched_tags: string[];
  ai_relevance_score: number | null;
  ai_summary: string | null;
  ai_subtitle: string | null;
  ai_tags: string[];
  ai_why_recommended: string | null;
  ai_label: string | null;
  ai_spoiler_warning: boolean;
  ai_game_title: string | null;
  upvotes: number;
  downvotes: number;
};

/**
 * GET /news/general
 * Returns curated general gaming news from external sources.
 * Triggers background ingestion to top-up the feed if needed.
 */
generalNewsRouter.get("/general", async (_req, res) => {
  try {
    const result = await db.query<GeneralNewsRow>(
      `
        SELECT
          gn.id,
          gn.source_type,
          gn.source_name,
          gn.external_id,
          gn.title,
          gn.url,
          gn.contents,
          gn.author,
          gn.image_url,
          gn.published_at,
          gn.matched_tags,
          gn.ai_relevance_score,
          gn.ai_summary,
          gn.ai_subtitle,
          gn.ai_tags,
          gn.ai_why_recommended,
          gn.ai_label,
          gn.ai_spoiler_warning,
          gn.ai_game_title
        FROM general_news gn
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE rating = 1)::int  AS upvotes,
            COUNT(*) FILTER (WHERE rating = -1)::int AS downvotes
          FROM general_news_feedback
          WHERE news_id = gn.id
        ) fb ON true
        WHERE COALESCE(gn.ai_relevance_score, 1) > 0
        ORDER BY (COALESCE(gn.ai_relevance_score, 0.5) + (fb.upvotes - fb.downvotes * 0.5) * 0.08) DESC, gn.published_at DESC
        LIMIT 50
      `
    );

    const news = result.rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceName: row.source_name,
      externalId: row.external_id,
      title: row.title,
      url: row.url,
      contents: row.contents,
      author: row.author,
      imageUrl: row.image_url,
      publishedAt: row.published_at,
      matchedTags: row.matched_tags,
      aiRelevanceScore: row.ai_relevance_score,
      aiSummary: row.ai_summary,
      aiSubtitle: row.ai_subtitle,
      aiTags: row.ai_tags ?? [],
      aiWhyRecommended: row.ai_why_recommended,
      aiLabel: row.ai_label as "top_news" | "community" | "personal" | null,
      aiSpoilerWarning: row.ai_spoiler_warning,
      aiGameTitle: row.ai_game_title,
      upvotes: row.upvotes,
      downvotes: row.downvotes
    }));

    res.json({ news });

    // Background: top-up the feed without blocking the response
    ingestAndCurateGeneralNews().catch((err) => {
      console.error("[generalNews] Background ingestion error:", err);
    });
  } catch (err) {
    console.error("[generalNews] GET /news/general error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /news/general/ingest
 * Admin endpoint — manually trigger ingestion + curation.
 */
generalNewsRouter.post("/general/ingest", async (_req, res) => {
  try {
    const result = await ingestAndCurateGeneralNews(true); // force bypasses 1-hour cooldown
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[generalNews] POST /news/general/ingest error:", err);
    res.status(500).json({ ok: false, error: "Ingestion failed" });
  }
});

/**
 * POST /news/general/curate
 * Admin endpoint — curate any un-curated rows without re-fetching.
 */
generalNewsRouter.post("/general/curate", async (_req, res) => {
  try {
    const curated = await curateUncuratedGeneralNews();
    res.json({ ok: true, curated });
  } catch (err) {
    console.error("[generalNews] POST /news/general/curate error:", err);
    res.status(500).json({ ok: false, error: "Curation failed" });
  }
});

/**
 * GET /news/general/debug-tags
 * Temp debug endpoint — returns raw AI output for one article to diagnose tag issues.
 */
generalNewsRouter.get("/general/debug-tags", async (_req, res) => {
  try {
    const { debugCurateOne } = await import("../lib/generalNewsIngestion.js");
    const result = await debugCurateOne();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /news/general/recurate
 * Admin endpoint — reset curation on all rows then run a curation pass.
 * Use this after prompt changes to regenerate all summaries.
 */
generalNewsRouter.post("/general/recurate", async (_req, res) => {
  try {
    const reset = await resetAllCuration();
    let totalCurated = 0;
    for (let i = 0; i < 20; i++) {
      const curated = await curateUncuratedGeneralNews();
      totalCurated += curated;
      const { rows } = await db.query(
        `SELECT 1 FROM general_news WHERE ai_curated_at IS NULL LIMIT 1`
      );
      if (rows.length === 0) break;
    }
    res.json({ ok: true, reset, curated: totalCurated });
  } catch (err) {
    console.error("[generalNews] POST /news/general/recurate error:", err);
    res.status(500).json({ ok: false, error: "Recurate failed" });
  }
});

/**
 * POST /news/general/:id/feedback
 * Record a user's thumbs up/down on AI summarization quality for an article.
 * Rates the summary quality, not the story itself.
 */
generalNewsRouter.post("/general/:id/feedback", requireSession, async (req, res) => {
  try {
    const discordUserId = res.locals.userId as string;
    const newsId = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(newsId)) {
      res.status(400).json({ error: "Invalid article ID" });
      return;
    }
    const { rating } = req.body as { rating: unknown };
    if (rating !== 1 && rating !== -1 && rating !== 0) {
      res.status(400).json({ error: "rating must be 1, -1, or 0" });
      return;
    }
    if (rating === 0) {
      await db.query(
        `DELETE FROM general_news_feedback
         WHERE user_id = (SELECT id FROM users WHERE discord_user_id = $1)
           AND news_id = $2`,
        [discordUserId, newsId]
      );
    } else {
      await db.query(
        `INSERT INTO general_news_feedback (user_id, news_id, rating)
         SELECT u.id, $2, $3 FROM users u WHERE u.discord_user_id = $1
         ON CONFLICT (user_id, news_id) DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()`,
        [discordUserId, newsId, rating]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[generalNews] POST /news/general/:id/feedback error:", err);
    res.status(500).json({ ok: false, error: "Failed to record feedback" });
  }
});
