import cookieSession from "cookie-session";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { env } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { gameNightRouter } from "./routes/gameNights.js";
import { profileRouter } from "./routes/profile.js";
import { recommendationRouter } from "./routes/recommendations.js";
import { steamRouter } from "./routes/steam.js";

const app = express();

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(
  cookieSession({
    name: "island_session",
    secret: env.SESSION_SECRET,
    sameSite: "lax",
    httpOnly: true
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/steam", steamRouter);
app.use("/recommendations", recommendationRouter);
app.use("/game-nights", gameNightRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request payload", details: error.flatten() });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(Number(env.API_PORT), () => {
  console.log(`API listening on ${env.API_PORT}`);
});
