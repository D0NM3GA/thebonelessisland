import { Router } from "express";
import { db } from "../db/client.js";
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
  ai_label: string | null;
  ai_spoiler_warning: boolean;
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
          id,
          source_type,
          source_name,
          external_id,
          title,
          url,
          contents,
          author,
          image_url,
          published_at,
          matched_tags,
          ai_relevance_score,
          ai_summary,
          ai_label,
          ai_spoiler_warning
        FROM general_news
        WHERE COALESCE(ai_relevance_score, 1) > 0
        ORDER BY ai_relevance_score DESC NULLS LAST, published_at DESC
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
      aiLabel: row.ai_label as "top_news" | "community" | "personal" | null,
      aiSpoilerWarning: row.ai_spoiler_warning
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
    const result = await ingestAndCurateGeneralNews();
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
 * POST /news/general/recurate
 * Admin endpoint — reset curation on all rows then run a curation pass.
 * Use this after prompt changes to regenerate all summaries.
 */
generalNewsRouter.post("/general/recurate", async (_req, res) => {
  try {
    const reset = await resetAllCuration();
    const curated = await curateUncuratedGeneralNews();
    res.json({ ok: true, reset, curated });
  } catch (err) {
    console.error("[generalNews] POST /news/general/recurate error:", err);
    res.status(500).json({ ok: false, error: "Recurate failed" });
  }
});
