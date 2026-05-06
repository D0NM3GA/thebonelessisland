import {
  InvalidGameInputError,
  type GameContext,
  type GameHandler,
  type GameState,
  type BlackjackCard,
  type ActiveGameRow,
  gameInternals
} from "../nuggiesGames.js";

// ── Card / deck primitives ──────────────────────────────────────────────────

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

type Rank = typeof RANKS[number];
type Suit = typeof SUITS[number];

type Card = BlackjackCard;

type StoredState = {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  bet: number;
};

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const d = [...arr];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return parseInt(rank, 10);
}

function handTotal(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += cardValue(c.rank);
    if (c.rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

type Outcome = "win" | "lose" | "push" | "blackjack";

function payoutFor(bet: number, result: Outcome): number {
  switch (result) {
    case "blackjack": return Math.floor(bet * 2.5);
    case "win":      return bet * 2;
    case "push":     return bet;
    case "lose":     return 0;
  }
}

function dealerPlay(state: StoredState): StoredState {
  const deck = [...state.deck];
  const dealerHand = [...state.dealerHand];
  while (handTotal(dealerHand) < 17) {
    const card = deck.pop();
    if (!card) break;
    dealerHand.push(card);
  }
  return { ...state, deck, dealerHand };
}

function evaluate(state: StoredState): Outcome {
  const playerTotal = handTotal(state.playerHand);
  const dealerTotal = handTotal(state.dealerHand);
  if (state.playerHand.length === 2 && playerTotal === 21) return "blackjack";
  if (playerTotal > 21) return "lose";
  if (dealerTotal > 21) return "win";
  if (playerTotal > dealerTotal) return "win";
  if (playerTotal < dealerTotal) return "lose";
  return "push";
}

// ── Helpers shared by start/step/autoResolve ────────────────────────────────

async function settleHand(
  ctx: GameContext,
  session: ActiveGameRow,
  state: StoredState,
  result: Outcome
): Promise<GameState> {
  // Bet was already debited at start. Credit the payout (if any).
  const payout = payoutFor(state.bet, result);
  let newBalance: number | undefined;
  if (payout > 0) {
    const r = await gameInternals.applyLedger(ctx.client, {
      userId: ctx.userId,
      amount: payout,
      type: "game_blackjack",
      reason: `Blackjack ${result} (bet ${state.bet}, payout ${payout})`
    });
    newBalance = r.newBalance;
  } else {
    // Loss: balance was already debited at start; no further write.
    // Read current balance for the response.
    const r = await ctx.client.query<{ balance: string }>(
      "SELECT balance FROM nuggies_balances WHERE user_id = $1",
      [ctx.userId]
    );
    newBalance = r.rows[0] ? parseInt(r.rows[0].balance, 10) : 0;
  }

  await gameInternals.deleteActiveGame(ctx.client, session.id);

  return {
    sessionId: session.id,
    gameType: "blackjack",
    bet: state.bet,
    status: "resolved",
    data: {
      playerHand: state.playerHand,
      dealerHand: state.dealerHand,
      playerTotal: handTotal(state.playerHand),
      dealerTotal: handTotal(state.dealerHand)
    },
    result: {
      type: "blackjack",
      playerHand: state.playerHand,
      dealerHand: state.dealerHand,
      result
    },
    payout,
    newBalance,
    expiresAt: new Date().toISOString()
  };
}

function activeStateView(session: ActiveGameRow, state: StoredState, expiresAt: string): GameState {
  return {
    sessionId: session.id,
    gameType: "blackjack",
    bet: state.bet,
    status: "active",
    data: {
      playerHand: state.playerHand,
      // Dealer's hole card hidden until resolve
      dealerHand: state.dealerHand.length > 0 ? [state.dealerHand[0]] : [],
      dealerHidden: state.dealerHand.length - 1,
      playerTotal: handTotal(state.playerHand),
      dealerVisibleTotal: state.dealerHand.length > 0 ? cardValue(state.dealerHand[0].rank) : 0
    },
    expiresAt
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const blackjackHandler: GameHandler<Record<string, never>> = {
  type: "blackjack",
  isStateful: true,

  validateInput(raw: unknown): Record<string, never> {
    // Blackjack takes no extra input beyond the bet.
    if (raw != null && typeof raw === "object" && Object.keys(raw).length > 0) {
      throw new InvalidGameInputError("Blackjack does not accept input fields");
    }
    return {};
  },

  async start(ctx, _input, bet, sessionId) {
    // Build initial deck + deal.
    const deck = shuffle(buildDeck());
    const playerHand: Card[] = [deck.pop()!, deck.pop()!];
    const dealerHand: Card[] = [deck.pop()!, deck.pop()!];
    const state: StoredState = { deck, playerHand, dealerHand, bet };

    // Persist the dealt hand into the active-game row.
    const expiresAt = await gameInternals.updateActiveGame(
      ctx.client,
      sessionId,
      state as unknown as Record<string, unknown>,
      true
    );

    // Debit the bet.
    await gameInternals.applyLedger(ctx.client, {
      userId: ctx.userId,
      amount: -bet,
      type: "game_blackjack_bet",
      reason: `Blackjack bet placed (bet ${bet})`
    });

    // Natural blackjack? Resolve immediately.
    if (handTotal(playerHand) === 21) {
      const fakeSession: ActiveGameRow = {
        id: sessionId,
        userId: ctx.userId,
        gameType: "blackjack",
        bet,
        state: state as unknown as Record<string, unknown>,
        startedAt: new Date().toISOString(),
        expiresAt,
        surface: ctx.surface
      };
      return settleHand(ctx, fakeSession, state, "blackjack");
    }

    return activeStateView(
      { id: sessionId, userId: ctx.userId, gameType: "blackjack", bet, state: state as unknown as Record<string, unknown>, startedAt: new Date().toISOString(), expiresAt, surface: ctx.surface },
      state,
      expiresAt
    );
  },

  async step(ctx, session, action) {
    const state = session.state as unknown as StoredState;

    if (action === "hit") {
      const card = state.deck.pop();
      if (!card) {
        // Deck exhausted — treat as stand.
        const dealerResolved = dealerPlay(state);
        return settleHand(ctx, session, dealerResolved, evaluate(dealerResolved));
      }
      const newState: StoredState = {
        ...state,
        playerHand: [...state.playerHand, card]
      };

      if (handTotal(newState.playerHand) > 21) {
        return settleHand(ctx, session, newState, "lose");
      }

      const newExpires = await gameInternals.updateActiveGame(
        ctx.client,
        session.id,
        newState as unknown as Record<string, unknown>,
        true
      );
      return activeStateView(session, newState, newExpires);
    }

    // action === "stand"
    const dealerResolved = dealerPlay(state);
    return settleHand(ctx, session, dealerResolved, evaluate(dealerResolved));
  },

  async autoResolve(ctx, session) {
    // Auto-stand: dealer plays out as if the player stood.
    const state = session.state as unknown as StoredState;
    const dealerResolved = dealerPlay(state);
    return settleHand(ctx, session, dealerResolved, evaluate(dealerResolved));
  }
};
