import { Request, Response, NextFunction } from "express";

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.locals.userId = userId;
  next();
}
