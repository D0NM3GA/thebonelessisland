import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireBotOrSession, requireParentRole, requireSession } from "../lib/auth.js";
import { ensureSettingsLoaded, getAISetting } from "../lib/serverSettings.js";
import {
  AlreadyClaimedError,
  DailyCapError,
  GameCooldownError,
  InsufficientFundsError,
  OptedOutError,
  applyTransaction,
  checkGameCooldown,
  claimDaily,
  executeTrade,
  getBalance,
  getEquippedItems,
  getRecentTransactions,
  processDefaultedLoans,
} from "../lib/nuggiesLedger.js";

export const nuggiesRouter = Router();

function getSetting(key: string, fallback: number): number {
  const raw = getAISetting(key);
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isEnabled(): boolean {
  return getAISetting("nuggies_enabled") !== "false";
}

async function resolveInternalId(discordUserId: string): Promise<bigint | null> {
  const r = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE discord_user_id = $1",
    [discordUserId]
  );
  return r.rows[0] ? BigInt(r.rows[0].id) : null;
}

// ── GET /nuggies/me ───────────────────────────────────────────────────────────

nuggiesRouter.get("/me", requireBotOrSession, async (_req, res) => {
  if (!isEnabled()) { res.json({ enabled: false }); return; }

  const discordUserId = String(res.locals.userId);
  const userId = await resolveInternalId(discordUserId);
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const [balRow, optRow, txRows, invRows, loanRows] = await Promise.all([
    db.query<{ balance: string }>(
      "SELECT balance FROM nuggies_balances WHERE user_id = $1",
      [userId]
    ),
    db.query<{ nuggies_opted_out: boolean }>(
      "SELECT nuggies_opted_out FROM users WHERE id = $1",
      [userId]
    ),
    db.query<{ id: string; amount: string; type: string; reason: string; reference_id: string | null; created_at: string }>(
      `SELECT id, amount, type, reason, reference_id, created_at
       FROM nuggies_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    ),
    db.query<{ item_id: string; equipped: boolean; name: string; item_type: string; item_data: Record<string, unknown>; price: string; purchased_at: string }>(
      `SELECT i.item_id, i.equipped, i.purchased_at, s.name, s.item_type, s.item_data, s.price
       FROM nuggies_inventory i
       INNER JOIN nuggies_shop_items s ON s.id = i.item_id
       WHERE i.user_id = $1
       ORDER BY i.purchased_at DESC`,
      [userId]
    ),
    db.query<{ id: string; status: string; principal: string; amount_due: string; collateral: string; due_at: string; lender_user_id: string; borrower_user_id: string }>(
      `SELECT id, status, principal, amount_due, collateral, due_at, lender_user_id, borrower_user_id
       FROM nuggies_loans
       WHERE (lender_user_id = $1 OR borrower_user_id = $1)
         AND status IN ('pending','active')
       ORDER BY created_at DESC`,
      [userId]
    ),
  ]);

  res.json({
    balance: parseInt(balRow.rows[0]?.balance ?? "0", 10),
    optedOut: optRow.rows[0]?.nuggies_opted_out ?? false,
    transactions: txRows.rows.map((r) => ({
      id: parseInt(r.id, 10),
      amount: parseInt(r.amount, 10),
      type: r.type,
      reason: r.reason,
      referenceId: r.reference_id,
      createdAt: r.created_at,
    })),
    inventory: invRows.rows.map((r) => ({
      itemId: parseInt(r.item_id, 10),
      name: r.name,
      itemType: r.item_type,
      itemData: r.item_data,
      price: parseInt(r.price, 10),
      equipped: r.equipped,
      purchasedAt: r.purchased_at,
    })),
    loans: loanRows.rows.map((r) => ({
      id: parseInt(r.id, 10),
      status: r.status,
      principal: parseInt(r.principal, 10),
      amountDue: parseInt(r.amount_due, 10),
      collateral: parseInt(r.collateral, 10),
      dueAt: r.due_at,
      isLender: String(r.lender_user_id) === String(userId),
    })),
  });
});

// ── GET /nuggies/user/:discordUserId ─────────────────────────────────────────

nuggiesRouter.get("/user/:discordUserId", requireBotOrSession, async (req, res) => {
  const userId = await resolveInternalId(String(req.params.discordUserId));
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const [balRow, equippedItems] = await Promise.all([
    db.query<{ balance: string }>(
      "SELECT balance FROM nuggies_balances WHERE user_id = $1",
      [userId]
    ),
    getEquippedItems(String(req.params.discordUserId)),
  ]);

  res.json({
    balance: parseInt(balRow.rows[0]?.balance ?? "0", 10),
    equippedItems,
  });
});

// ── GET /nuggies/leaderboard ──────────────────────────────────────────────────

nuggiesRouter.get("/leaderboard", requireBotOrSession, async (_req, res) => {
  const r = await db.query<{ discord_user_id: string; username: string; avatar_url: string | null; balance: string }>(
    `SELECT u.discord_user_id, dp.username, dp.avatar_url, nb.balance
     FROM nuggies_balances nb
     INNER JOIN users u ON u.id = nb.user_id
     INNER JOIN discord_profiles dp ON dp.user_id = nb.user_id
     WHERE u.nuggies_opted_out = FALSE
     ORDER BY nb.balance DESC
     LIMIT 25`
  );

  // Attach equipped title for each
  const rows = await Promise.all(
    r.rows.map(async (row, i) => {
      const equipped = await getEquippedItems(row.discord_user_id);
      const title = equipped.find((e) => e.itemType === "title") ?? null;
      return {
        rank: i + 1,
        discordUserId: row.discord_user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        balance: parseInt(row.balance, 10),
        equippedTitle: title,
      };
    })
  );

  res.json({ leaderboard: rows });
});

// ── POST /nuggies/daily ───────────────────────────────────────────────────────

nuggiesRouter.post("/daily", requireBotOrSession, async (_req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  try {
    const result = await claimDaily(String(res.locals.userId));
    res.json(result);
  } catch (err) {
    if (err instanceof AlreadyClaimedError) { res.status(409).json({ error: err.message }); return; }
    if (err instanceof OptedOutError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
});

// ── POST /nuggies/opt-out ─────────────────────────────────────────────────────

nuggiesRouter.post("/opt-out", requireBotOrSession, async (_req, res) => {
  await db.query(
    "UPDATE users SET nuggies_opted_out = TRUE WHERE discord_user_id = $1",
    [String(res.locals.userId)]
  );
  res.json({ ok: true });
});

// ── POST /nuggies/opt-in ──────────────────────────────────────────────────────

nuggiesRouter.post("/opt-in", requireBotOrSession, async (_req, res) => {
  await db.query(
    "UPDATE users SET nuggies_opted_out = FALSE WHERE discord_user_id = $1",
    [String(res.locals.userId)]
  );
  res.json({ ok: true });
});

// ── GET /nuggies/shop ─────────────────────────────────────────────────────────

nuggiesRouter.get("/shop", requireBotOrSession, async (_req, res) => {
  const discordUserId = String(res.locals.userId);
  const userId = await resolveInternalId(discordUserId);

  const r = await db.query<{ id: string; name: string; description: string; price: string; item_type: string; item_data: Record<string, unknown> }>(
    `SELECT id, name, description, price, item_type, item_data
     FROM nuggies_shop_items
     WHERE is_active = TRUE
     ORDER BY item_type, price`
  );

  let ownedIds = new Set<number>();
  let equippedIds = new Set<number>();
  if (userId) {
    const inv = await db.query<{ item_id: string; equipped: boolean }>(
      "SELECT item_id, equipped FROM nuggies_inventory WHERE user_id = $1",
      [userId]
    );
    ownedIds = new Set(inv.rows.map((r) => parseInt(r.item_id, 10)));
    equippedIds = new Set(inv.rows.filter((r) => r.equipped).map((r) => parseInt(r.item_id, 10)));
  }

  res.json({
    items: r.rows.map((row) => ({
      id: parseInt(row.id, 10),
      name: row.name,
      description: row.description,
      price: parseInt(row.price, 10),
      itemType: row.item_type,
      itemData: row.item_data,
      owned: ownedIds.has(parseInt(row.id, 10)),
      equipped: equippedIds.has(parseInt(row.id, 10)),
    })),
  });
});

// ── POST /nuggies/shop/:itemId/buy ────────────────────────────────────────────

const buySchema = z.object({}).strict();

nuggiesRouter.post("/shop/:itemId/buy", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const discordUserId = String(res.locals.userId);
  const itemId = parseInt(String(req.params.itemId), 10);
  if (!Number.isFinite(itemId)) { res.status(400).json({ error: "Invalid item ID" }); return; }

  const userId = await resolveInternalId(discordUserId);
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const item = await db.query<{ id: string; name: string; price: string; is_active: boolean }>(
    "SELECT id, name, price, is_active FROM nuggies_shop_items WHERE id = $1",
    [itemId]
  );
  if (!item.rows[0]) { res.status(404).json({ error: "Item not found" }); return; }
  if (!item.rows[0].is_active) { res.status(400).json({ error: "Item not available" }); return; }

  const alreadyOwned = await db.query(
    "SELECT 1 FROM nuggies_inventory WHERE user_id = $1 AND item_id = $2",
    [userId, itemId]
  );
  if (alreadyOwned.rows.length > 0) { res.status(409).json({ error: "Already owned" }); return; }

  const price = parseInt(item.rows[0].price, 10);

  try {
    const { newBalance } = await applyTransaction({
      discordUserId,
      amount: -price,
      type: "spend",
      reason: `Bought ${item.rows[0].name}`,
      referenceId: `shop:${itemId}`,
    });

    await db.query(
      "INSERT INTO nuggies_inventory (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, itemId]
    );

    res.json({ ok: true, newBalance, item: { id: itemId, name: item.rows[0].name } });
  } catch (err) {
    if (err instanceof InsufficientFundsError) { res.status(400).json({ error: "Insufficient Nuggies" }); return; }
    if (err instanceof OptedOutError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
});

// ── GET /nuggies/inventory ────────────────────────────────────────────────────

nuggiesRouter.get("/inventory", requireBotOrSession, async (_req, res) => {
  const userId = await resolveInternalId(String(res.locals.userId));
  if (!userId) { res.json({ inventory: [] }); return; }

  const r = await db.query<{ item_id: string; equipped: boolean; purchased_at: string; name: string; item_type: string; item_data: Record<string, unknown>; price: string }>(
    `SELECT i.item_id, i.equipped, i.purchased_at, s.name, s.item_type, s.item_data, s.price
     FROM nuggies_inventory i
     INNER JOIN nuggies_shop_items s ON s.id = i.item_id
     WHERE i.user_id = $1
     ORDER BY i.purchased_at DESC`,
    [userId]
  );

  res.json({
    inventory: r.rows.map((row) => ({
      itemId: parseInt(row.item_id, 10),
      name: row.name,
      itemType: row.item_type,
      itemData: row.item_data,
      price: parseInt(row.price, 10),
      equipped: row.equipped,
      purchasedAt: row.purchased_at,
    })),
  });
});

// ── POST /nuggies/inventory/:itemId/equip ─────────────────────────────────────

nuggiesRouter.post("/inventory/:itemId/equip", requireBotOrSession, async (req, res) => {
  const discordUserId = String(res.locals.userId);
  const itemId = parseInt(String(req.params.itemId), 10);
  const userId = await resolveInternalId(discordUserId);
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const owned = await db.query<{ equipped: boolean; item_type: string }>(
    `SELECT i.equipped, s.item_type
     FROM nuggies_inventory i
     INNER JOIN nuggies_shop_items s ON s.id = i.item_id
     WHERE i.user_id = $1 AND i.item_id = $2`,
    [userId, itemId]
  );
  if (!owned.rows[0]) { res.status(404).json({ error: "Item not in inventory" }); return; }

  const { equipped, item_type } = owned.rows[0];
  const nowEquipped = !equipped;

  if (nowEquipped) {
    // Unequip any other item of same type first (one title, one flair, one badge at a time)
    await db.query(
      `UPDATE nuggies_inventory i
       SET equipped = FALSE
       FROM nuggies_shop_items s
       WHERE i.item_id = s.id
         AND i.user_id = $1
         AND s.item_type = $2
         AND i.equipped = TRUE`,
      [userId, item_type]
    );
  }

  await db.query(
    "UPDATE nuggies_inventory SET equipped = $1 WHERE user_id = $2 AND item_id = $3",
    [nowEquipped, userId, itemId]
  );

  res.json({ ok: true, equipped: nowEquipped });
});

// ── POST /nuggies/trade ───────────────────────────────────────────────────────

const tradeSchema = z.object({
  toDiscordUserId: z.string().min(1),
  amount: z.number().int().positive(),
});

nuggiesRouter.post("/trade", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { toDiscordUserId, amount } = parsed.data;
  const fromDiscordUserId = String(res.locals.userId);

  if (fromDiscordUserId === toDiscordUserId) {
    res.status(400).json({ error: "Cannot trade with yourself" });
    return;
  }

  await ensureSettingsLoaded();
  const minAmt = getSetting("nuggies_give_min", 1);
  const maxAmt = getSetting("nuggies_give_max", 1000);
  if (amount < minAmt || amount > maxAmt) {
    res.status(400).json({ error: `Amount must be ${minAmt}–${maxAmt}` });
    return;
  }

  // 60s per-sender cooldown
  const fromId = await resolveInternalId(fromDiscordUserId);
  if (fromId) {
    const lastTrade = await db.query<{ created_at: string }>(
      `SELECT created_at FROM nuggies_transactions
       WHERE user_id = $1 AND type = 'trade_out'
       ORDER BY created_at DESC LIMIT 1`,
      [fromId]
    );
    if (lastTrade.rows.length > 0) {
      const elapsed = (Date.now() - new Date(lastTrade.rows[0].created_at).getTime()) / 1000;
      if (elapsed < 60) {
        res.status(429).json({ error: `Trade cooldown: ${Math.ceil(60 - elapsed)}s remaining` });
        return;
      }
    }
  }

  try {
    const result = await executeTrade({ fromDiscordUserId, toDiscordUserId, amount });
    res.json(result);
  } catch (err) {
    if (err instanceof InsufficientFundsError) { res.status(400).json({ error: "Insufficient Nuggies" }); return; }
    if (err instanceof OptedOutError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
});

// ── POST /nuggies/loan/offer ──────────────────────────────────────────────────

const loanOfferSchema = z.object({
  toDiscordUserId: z.string().min(1),
  amount: z.number().int().positive(),
  interestPct: z.number().min(0).max(100).optional(),
  durationDays: z.number().int().positive().optional(),
  collateral: z.number().int().min(0).optional(),
});

nuggiesRouter.post("/loan/offer", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const parsed = loanOfferSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const discordUserId = String(res.locals.userId);
  const { toDiscordUserId, amount, interestPct, durationDays, collateral = 0 } = parsed.data;

  await ensureSettingsLoaded();
  const defaultRate = getSetting("nuggies_loan_default_rate", 10);
  const maxDays = getSetting("nuggies_loan_max_days", 7);
  const rate = (interestPct ?? defaultRate) / 100;
  const days = Math.min(durationDays ?? maxDays, maxDays);
  const amountDue = Math.ceil(amount * (1 + rate));
  const dueAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const lenderId = await resolveInternalId(discordUserId);
  const borrowerId = await resolveInternalId(toDiscordUserId);
  if (!lenderId || !borrowerId) { res.status(404).json({ error: "User not found" }); return; }

  const r = await db.query<{ id: string }>(
    `INSERT INTO nuggies_loans
       (lender_user_id, borrower_user_id, principal, interest_rate, amount_due, collateral, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [lenderId, borrowerId, amount, rate, amountDue, collateral, dueAt]
  );

  res.json({ loanId: parseInt(r.rows[0].id, 10), amountDue, dueAt, collateral });
});

// ── POST /nuggies/loan/:id/accept ─────────────────────────────────────────────

nuggiesRouter.post("/loan/:id/accept", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const loanId = parseInt(String(req.params.id), 10);
  const discordUserId = String(res.locals.userId);
  const userId = await resolveInternalId(discordUserId);
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const loan = await db.query<{ id: string; lender_user_id: string; borrower_user_id: string; principal: string; amount_due: string; collateral: string; due_at: string; status: string }>(
    "SELECT * FROM nuggies_loans WHERE id = $1",
    [loanId]
  );
  if (!loan.rows[0]) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.rows[0].status !== "pending") { res.status(400).json({ error: "Loan not in pending state" }); return; }
  if (String(loan.rows[0].borrower_user_id) !== String(userId)) {
    res.status(403).json({ error: "Not the intended borrower" });
    return;
  }

  const principal = parseInt(loan.rows[0].principal, 10);
  const collateral = parseInt(loan.rows[0].collateral, 10);
  const lenderDiscordId = await db.query<{ discord_user_id: string }>(
    "SELECT discord_user_id FROM users WHERE id = $1",
    [loan.rows[0].lender_user_id]
  );
  const lenderDId = lenderDiscordId.rows[0]?.discord_user_id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Lock collateral from borrower if required
    if (collateral > 0) {
      const balRow = await client.query<{ balance: string }>(
        "SELECT balance FROM nuggies_balances WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const bal = parseInt(balRow.rows[0]?.balance ?? "0", 10);
      if (bal < collateral) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Insufficient Nuggies for collateral" });
        return;
      }
      await client.query(
        "UPDATE nuggies_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2",
        [collateral, userId]
      );
      await client.query(
        `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
         VALUES ($1, $2, 'loan_out', 'Collateral locked for loan', $3)`,
        [userId, -collateral, `loan:${loanId}`]
      );
    }

    // Transfer principal from lender to borrower
    await client.query(
      "UPDATE nuggies_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2",
      [principal, loan.rows[0].lender_user_id]
    );
    await client.query(
      `INSERT INTO nuggies_balances (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = nuggies_balances.balance + $2, updated_at = NOW()`,
      [userId, principal]
    );
    await client.query(
      `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
       VALUES ($1, $2, 'loan_out', 'Loan issued', $3)`,
      [loan.rows[0].lender_user_id, -principal, `loan:${loanId}`]
    );
    await client.query(
      `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
       VALUES ($1, $2, 'loan_in', 'Loan received', $3)`,
      [userId, principal, `loan:${loanId}`]
    );

    await client.query(
      "UPDATE nuggies_loans SET status = 'active' WHERE id = $1",
      [loanId]
    );

    await client.query("COMMIT");
    res.json({ ok: true, principal, dueAt: loan.rows[0].due_at });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// ── POST /nuggies/loan/:id/repay ──────────────────────────────────────────────

nuggiesRouter.post("/loan/:id/repay", requireBotOrSession, async (req, res) => {
  const loanId = parseInt(String(req.params.id), 10);
  const discordUserId = String(res.locals.userId);
  const userId = await resolveInternalId(discordUserId);
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const loan = await db.query<{ lender_user_id: string; borrower_user_id: string; amount_due: string; collateral: string; status: string }>(
    "SELECT * FROM nuggies_loans WHERE id = $1",
    [loanId]
  );
  if (!loan.rows[0]) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.rows[0].status !== "active") { res.status(400).json({ error: "Loan not active" }); return; }
  if (String(loan.rows[0].borrower_user_id) !== String(userId)) {
    res.status(403).json({ error: "Not the borrower" });
    return;
  }

  const amountDue = parseInt(loan.rows[0].amount_due, 10);
  const collateral = parseInt(loan.rows[0].collateral, 10);
  const lenderId = loan.rows[0].lender_user_id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const balRow = await client.query<{ balance: string }>(
      "SELECT balance FROM nuggies_balances WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const bal = parseInt(balRow.rows[0]?.balance ?? "0", 10);
    if (bal < amountDue) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Insufficient Nuggies to repay" });
      return;
    }

    // Borrower pays amount_due
    await client.query(
      "UPDATE nuggies_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2",
      [amountDue, userId]
    );
    await client.query(
      `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
       VALUES ($1, $2, 'loan_repay', 'Loan repaid', $3)`,
      [userId, -amountDue, `loan:${loanId}`]
    );

    // Lender receives amount_due
    await client.query(
      `INSERT INTO nuggies_balances (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = nuggies_balances.balance + $2, updated_at = NOW()`,
      [lenderId, amountDue]
    );
    await client.query(
      `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
       VALUES ($1, $2, 'loan_repay', 'Loan repayment received', $3)`,
      [lenderId, amountDue, `loan:${loanId}`]
    );

    // Return collateral to borrower
    if (collateral > 0) {
      await client.query(
        "UPDATE nuggies_balances SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2",
        [collateral, userId]
      );
      await client.query(
        `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
         VALUES ($1, $2, 'loan_forfeit_in', 'Collateral returned after repayment', $3)`,
        [userId, collateral, `loan:${loanId}`]
      );
    }

    await client.query(
      "UPDATE nuggies_loans SET status = 'repaid', resolved_at = NOW() WHERE id = $1",
      [loanId]
    );

    await client.query("COMMIT");
    res.json({ ok: true, amountPaid: amountDue, collateralReturned: collateral });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// ── POST /nuggies/loan/:id/cancel ─────────────────────────────────────────────

nuggiesRouter.post("/loan/:id/cancel", requireBotOrSession, async (req, res) => {
  const loanId = parseInt(String(req.params.id), 10);
  const userId = await resolveInternalId(String(res.locals.userId));

  const loan = await db.query<{ lender_user_id: string; status: string }>(
    "SELECT lender_user_id, status FROM nuggies_loans WHERE id = $1",
    [loanId]
  );
  if (!loan.rows[0]) { res.status(404).json({ error: "Loan not found" }); return; }
  if (loan.rows[0].status !== "pending") { res.status(400).json({ error: "Only pending loans can be cancelled" }); return; }
  if (String(loan.rows[0].lender_user_id) !== String(userId)) {
    res.status(403).json({ error: "Only the lender can cancel" });
    return;
  }

  await db.query(
    "UPDATE nuggies_loans SET status = 'cancelled', resolved_at = NOW() WHERE id = $1",
    [loanId]
  );
  res.json({ ok: true });
});

// ── GET /nuggies/loans ────────────────────────────────────────────────────────

nuggiesRouter.get("/loans", requireBotOrSession, async (_req, res) => {
  const userId = await resolveInternalId(String(res.locals.userId));
  if (!userId) { res.json({ loans: [] }); return; }

  await processDefaultedLoans();

  const r = await db.query<{ id: string; status: string; principal: string; amount_due: string; collateral: string; due_at: string; lender_user_id: string; borrower_user_id: string; created_at: string }>(
    `SELECT id, status, principal, amount_due, collateral, due_at, lender_user_id, borrower_user_id, created_at
     FROM nuggies_loans
     WHERE lender_user_id = $1 OR borrower_user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  res.json({
    loans: r.rows.map((row) => ({
      id: parseInt(row.id, 10),
      status: row.status,
      principal: parseInt(row.principal, 10),
      amountDue: parseInt(row.amount_due, 10),
      collateral: parseInt(row.collateral, 10),
      dueAt: row.due_at,
      isLender: String(row.lender_user_id) === String(userId),
      createdAt: row.created_at,
    })),
  });
});

// ── GET /nuggies/market ───────────────────────────────────────────────────────

nuggiesRouter.get("/market", requireBotOrSession, async (_req, res) => {
  const r = await db.query<{ id: string; price: string; listed_at: string; item_id: string; name: string; item_type: string; item_data: Record<string, unknown>; seller_discord: string; seller_username: string }>(
    `SELECT ml.id, ml.price, ml.listed_at, ml.item_id,
            s.name, s.item_type, s.item_data,
            u.discord_user_id AS seller_discord,
            dp.username AS seller_username
     FROM nuggies_market_listings ml
     INNER JOIN nuggies_shop_items s ON s.id = ml.item_id
     INNER JOIN users u ON u.id = ml.seller_user_id
     INNER JOIN discord_profiles dp ON dp.user_id = ml.seller_user_id
     WHERE ml.status = 'active'
     ORDER BY ml.listed_at DESC`
  );

  res.json({
    listings: r.rows.map((row) => ({
      id: parseInt(row.id, 10),
      price: parseInt(row.price, 10),
      listedAt: row.listed_at,
      item: {
        id: parseInt(row.item_id, 10),
        name: row.name,
        itemType: row.item_type,
        itemData: row.item_data,
      },
      seller: { discordUserId: row.seller_discord, username: row.seller_username },
    })),
  });
});

// ── POST /nuggies/market/list ─────────────────────────────────────────────────

const marketListSchema = z.object({
  itemId: z.number().int().positive(),
  price: z.number().int().positive(),
});

nuggiesRouter.post("/market/list", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const parsed = marketListSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { itemId, price } = parsed.data;
  const userId = await resolveInternalId(String(res.locals.userId));
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  const owned = await db.query(
    "SELECT 1 FROM nuggies_inventory WHERE user_id = $1 AND item_id = $2",
    [userId, itemId]
  );
  if (!owned.rows[0]) { res.status(400).json({ error: "Item not in inventory" }); return; }

  // Unequip if equipped
  await db.query(
    "UPDATE nuggies_inventory SET equipped = FALSE WHERE user_id = $1 AND item_id = $2",
    [userId, itemId]
  );

  try {
    const r = await db.query<{ id: string }>(
      `INSERT INTO nuggies_market_listings (seller_user_id, item_id, price)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, itemId, price]
    );
    res.json({ listingId: parseInt(r.rows[0].id, 10) });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      res.status(409).json({ error: "Already listed" });
      return;
    }
    throw err;
  }
});

// ── POST /nuggies/market/:id/buy ──────────────────────────────────────────────

nuggiesRouter.post("/market/:id/buy", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const listingId = parseInt(String(req.params.id), 10);
  const buyerDiscordId = String(res.locals.userId);
  const buyerId = await resolveInternalId(buyerDiscordId);
  if (!buyerId) { res.status(404).json({ error: "User not found" }); return; }

  await ensureSettingsLoaded();
  const feePct = getSetting("nuggies_market_fee_pct", 3);

  const listing = await db.query<{ id: string; seller_user_id: string; item_id: string; price: string; status: string }>(
    "SELECT id, seller_user_id, item_id, price, status FROM nuggies_market_listings WHERE id = $1",
    [listingId]
  );
  if (!listing.rows[0]) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.rows[0].status !== "active") { res.status(400).json({ error: "Listing no longer active" }); return; }
  if (String(listing.rows[0].seller_user_id) === String(buyerId)) {
    res.status(400).json({ error: "Cannot buy your own listing" });
    return;
  }

  const price = parseInt(listing.rows[0].price, 10);
  const fee = Math.max(1, Math.round(price * feePct / 100));
  const sellerReceives = price - fee;
  const sellerId = listing.rows[0].seller_user_id;
  const itemId = parseInt(listing.rows[0].item_id, 10);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Deduct from buyer
    const buyerBal = await client.query<{ balance: string }>(
      "SELECT balance FROM nuggies_balances WHERE user_id = $1 FOR UPDATE",
      [buyerId]
    );
    const bal = parseInt(buyerBal.rows[0]?.balance ?? "0", 10);
    if (bal < price) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Insufficient Nuggies" });
      return;
    }

    await client.query(
      "UPDATE nuggies_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2",
      [price, buyerId]
    );
    await client.query(
      `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
       VALUES ($1, $2, 'market_buy', 'Marketplace purchase', $3)`,
      [buyerId, -price, `market:${listingId}`]
    );

    // Credit seller (minus fee — fee burns)
    await client.query(
      `INSERT INTO nuggies_balances (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = nuggies_balances.balance + $2, updated_at = NOW()`,
      [sellerId, sellerReceives]
    );
    await client.query(
      `INSERT INTO nuggies_transactions (user_id, amount, type, reason, reference_id)
       VALUES ($1, $2, 'market_sell', 'Marketplace sale', $3)`,
      [sellerId, sellerReceives, `market:${listingId}`]
    );

    // Transfer item from seller to buyer
    await client.query(
      "DELETE FROM nuggies_inventory WHERE user_id = $1 AND item_id = $2",
      [sellerId, itemId]
    );
    await client.query(
      "INSERT INTO nuggies_inventory (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [buyerId, itemId]
    );

    // Mark listing sold
    await client.query(
      "UPDATE nuggies_market_listings SET status = 'sold', buyer_user_id = $1, resolved_at = NOW() WHERE id = $2",
      [buyerId, listingId]
    );

    await client.query("COMMIT");
    res.json({ ok: true, price, sellerReceives, fee });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// ── DELETE /nuggies/market/:id ────────────────────────────────────────────────

nuggiesRouter.delete("/market/:id", requireBotOrSession, async (req, res) => {
  const listingId = parseInt(String(req.params.id), 10);
  const userId = await resolveInternalId(String(res.locals.userId));

  const listing = await db.query<{ seller_user_id: string; status: string }>(
    "SELECT seller_user_id, status FROM nuggies_market_listings WHERE id = $1",
    [listingId]
  );
  if (!listing.rows[0]) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.rows[0].status !== "active") { res.status(400).json({ error: "Listing not active" }); return; }
  if (String(listing.rows[0].seller_user_id) !== String(userId)) {
    res.status(403).json({ error: "Not your listing" });
    return;
  }

  await db.query(
    "UPDATE nuggies_market_listings SET status = 'cancelled', resolved_at = NOW() WHERE id = $1",
    [listingId]
  );
  res.json({ ok: true });
});

// ── POST /nuggies/admin/grant ─────────────────────────────────────────────────

const grantSchema = z.object({
  toDiscordUserId: z.string().min(1),
  amount: z.number().int(),
  reason: z.string().min(1),
});

nuggiesRouter.post("/admin/grant", requireBotOrSession, requireParentRole, async (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { toDiscordUserId, amount, reason } = parsed.data;
  const adminDiscordId = String(res.locals.userId);

  if (amount === 0) { res.status(400).json({ error: "Amount cannot be 0" }); return; }

  try {
    const { newBalance } = await applyTransaction({
      discordUserId: toDiscordUserId,
      amount,
      type: amount > 0 ? "admin_grant" : "admin_deduct",
      reason,
      createdByDiscordUserId: adminDiscordId,
      skipOptedOutCheck: true,
      skipDailyCapCheck: true,
    });
    res.json({ ok: true, newBalance });
  } catch (err) {
    if (err instanceof InsufficientFundsError) { res.status(400).json({ error: "Would result in negative balance" }); return; }
    throw err;
  }
});

// ── POST /nuggies/admin/award-attendance/:gameNightId ─────────────────────────

nuggiesRouter.post("/admin/award-attendance/:gameNightId", requireBotOrSession, requireParentRole, async (req, res) => {
  const gameNightId = parseInt(String(req.params.gameNightId), 10);
  if (!Number.isFinite(gameNightId)) { res.status(400).json({ error: "Invalid game night ID" }); return; }

  await ensureSettingsLoaded();
  const rewardAmount = getSetting("nuggies_attendance_amount", 200);

  const attendees = await db.query<{ discord_user_id: string }>(
    `SELECT u.discord_user_id
     FROM game_night_attendees gna
     INNER JOIN users u ON u.id = gna.user_id
     WHERE gna.game_night_id = $1
       AND gna.nuggies_awarded = FALSE
       AND u.nuggies_opted_out = FALSE`,
    [gameNightId]
  );

  if (attendees.rows.length === 0) {
    res.json({ awarded: 0, message: "No eligible attendees (already awarded or all opted out)" });
    return;
  }

  let awarded = 0;
  const errors: string[] = [];

  for (const attendee of attendees.rows) {
    try {
      await applyTransaction({
        discordUserId: attendee.discord_user_id,
        amount: rewardAmount,
        type: "attendance",
        reason: `Game night attendance reward (night #${gameNightId})`,
        referenceId: `attendance:${gameNightId}`,
        skipOptedOutCheck: true,
        skipDailyCapCheck: true,
      });
      await db.query(
        `UPDATE game_night_attendees SET nuggies_awarded = TRUE
         WHERE game_night_id = $1
           AND user_id = (SELECT id FROM users WHERE discord_user_id = $2)`,
        [gameNightId, attendee.discord_user_id]
      );
      awarded++;
    } catch (err) {
      errors.push(attendee.discord_user_id);
    }
  }

  res.json({ awarded, errors });
});

// ── GET /nuggies/admin/overview ───────────────────────────────────────────────

nuggiesRouter.get("/admin/overview", requireBotOrSession, requireParentRole, async (_req, res) => {
  const [supplyRow, optedOutRow, topRow] = await Promise.all([
    db.query<{ total: string }>("SELECT COALESCE(SUM(balance), 0) AS total FROM nuggies_balances"),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE nuggies_opted_out = TRUE"),
    db.query<{ discord_user_id: string; username: string; balance: string }>(
      `SELECT u.discord_user_id, dp.username, nb.balance
       FROM nuggies_balances nb
       INNER JOIN users u ON u.id = nb.user_id
       INNER JOIN discord_profiles dp ON dp.user_id = nb.user_id
       WHERE u.nuggies_opted_out = FALSE
       ORDER BY nb.balance DESC LIMIT 10`
    ),
  ]);

  res.json({
    totalSupply: parseInt(supplyRow.rows[0]?.total ?? "0", 10),
    optedOutCount: parseInt(optedOutRow.rows[0]?.count ?? "0", 10),
    topHolders: topRow.rows.map((r) => ({
      discordUserId: r.discord_user_id,
      username: r.username,
      balance: parseInt(r.balance, 10),
    })),
  });
});

// ── POST /nuggies/admin/shop-item ─────────────────────────────────────────────

const shopItemSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().positive(),
  itemType: z.enum(["title", "flair", "badge"]),
  itemData: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});

// ── POST /nuggies/game/cooldown-check ────────────────────────────────────────

nuggiesRouter.post("/game/cooldown-check", requireBotOrSession, async (_req, res) => {
  const userId = await resolveInternalId(String(res.locals.userId));
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  try {
    await checkGameCooldown(userId);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof GameCooldownError) {
      res.status(429).json({ error: err.message, secondsLeft: err.secondsLeft });
      return;
    }
    throw err;
  }
});

// ── POST /nuggies/game/coinflip ───────────────────────────────────────────────

const coinflipSchema = z.object({
  bet: z.number().int().positive(),
  won: z.boolean(),
});

nuggiesRouter.post("/game/coinflip", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const parsed = coinflipSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { bet, won } = parsed.data;
  const discordUserId = String(res.locals.userId);

  await ensureSettingsLoaded();
  const maxBet = getSetting("nuggies_max_bet", 500);
  if (bet > maxBet) { res.status(400).json({ error: `Max bet is ${maxBet}` }); return; }

  const userId = await resolveInternalId(discordUserId);
  if (!userId) { res.status(404).json({ error: "User not found" }); return; }

  try {
    await checkGameCooldown(userId);
  } catch (err) {
    if (err instanceof GameCooldownError) {
      res.status(429).json({ error: err.message, secondsLeft: err.secondsLeft });
      return;
    }
    throw err;
  }

  const payout = won ? Math.floor(bet * 1.9) : 0;
  const net = payout - bet;

  try {
    const { newBalance } = await applyTransaction({
      discordUserId,
      amount: net,
      type: "game_coinflip",
      reason: won ? `Coinflip win (bet ${bet}, payout ${payout})` : `Coinflip loss (bet ${bet})`,
      skipDailyCapCheck: true,
    });
    res.json({ ok: true, newBalance, won, payout });
  } catch (err) {
    if (err instanceof InsufficientFundsError) { res.status(400).json({ error: "Insufficient Nuggies" }); return; }
    if (err instanceof OptedOutError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
});

// ── POST /nuggies/game/blackjack ──────────────────────────────────────────────

const blackjackResultSchema = z.object({
  bet: z.number().int().positive(),
  payout: z.number().int().min(0),
  result: z.enum(["win", "lose", "push", "blackjack"]),
});

nuggiesRouter.post("/game/blackjack", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const parsed = blackjackResultSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { bet, payout, result } = parsed.data;
  const discordUserId = String(res.locals.userId);
  const net = payout - bet;

  try {
    const { newBalance } = await applyTransaction({
      discordUserId,
      amount: net,
      type: "game_blackjack",
      reason: `Blackjack ${result} (bet ${bet}, payout ${payout})`,
      skipDailyCapCheck: true,
    });
    res.json({ ok: true, newBalance, result, payout });
  } catch (err) {
    if (err instanceof InsufficientFundsError) { res.status(400).json({ error: "Insufficient Nuggies" }); return; }
    if (err instanceof OptedOutError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
});

// ── POST /nuggies/game/guessnumber ────────────────────────────────────────────

const guessNumberResultSchema = z.object({
  bet: z.number().int().positive(),
  payout: z.number().int().min(0),
  won: z.boolean(),
});

nuggiesRouter.post("/game/guessnumber", requireBotOrSession, async (req, res) => {
  if (!isEnabled()) { res.status(503).json({ error: "Nuggies disabled" }); return; }

  const parsed = guessNumberResultSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { bet, payout, won } = parsed.data;
  const discordUserId = String(res.locals.userId);
  const net = payout - bet;

  try {
    const { newBalance } = await applyTransaction({
      discordUserId,
      amount: net,
      type: "game_guessnumber",
      reason: won ? `Guess the number win (bet ${bet}, payout ${payout})` : `Guess the number loss (bet ${bet})`,
      skipDailyCapCheck: true,
    });
    res.json({ ok: true, newBalance, won, payout });
  } catch (err) {
    if (err instanceof InsufficientFundsError) { res.status(400).json({ error: "Insufficient Nuggies" }); return; }
    if (err instanceof OptedOutError) { res.status(403).json({ error: err.message }); return; }
    throw err;
  }
});

// ── POST /nuggies/admin/shop-item ─────────────────────────────────────────────

nuggiesRouter.post("/admin/shop-item", requireBotOrSession, requireParentRole, async (req, res) => {
  const parsed = shopItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { id, name, description, price, itemType, itemData, isActive = true } = parsed.data;

  if (id) {
    await db.query(
      `UPDATE nuggies_shop_items
       SET name = $1, description = $2, price = $3, item_type = $4, item_data = $5, is_active = $6
       WHERE id = $7`,
      [name, description, price, itemType, JSON.stringify(itemData), isActive, id]
    );
    res.json({ ok: true, id });
  } else {
    const r = await db.query<{ id: string }>(
      `INSERT INTO nuggies_shop_items (name, description, price, item_type, item_data, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, description, price, itemType, JSON.stringify(itemData), isActive]
    );
    res.json({ ok: true, id: parseInt(r.rows[0].id, 10) });
  }
});
