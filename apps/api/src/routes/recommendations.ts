import express from "express";
import { z } from "zod";
import { env } from "../config.js";
import { whatCanWePlay } from "../lib/recommend.js";

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
  res.json({ recommendations });
});
