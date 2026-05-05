// ── Blackjack Game Logic ──────────────────────────────────────────────────────

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

type Card = { rank: typeof RANKS[number]; suit: typeof SUITS[number] };

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardValue(rank: typeof RANKS[number]): number {
  if (rank === "A") return 11;
  if (["J", "Q", "K"].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function handTotal(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function formatCard(card: Card): string {
  return `\`${card.rank}${card.suit}\``;
}

export function formatHand(hand: Card[], hideSecond = false): string {
  if (hideSecond && hand.length >= 2) {
    return `${formatCard(hand[0])} \`??\``;
  }
  return hand.map(formatCard).join(" ");
}

export type BlackjackResult = "win" | "lose" | "push" | "blackjack";

export type BlackjackGame = {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  bet: number;
  done: boolean;
};

export function startBlackjack(bet: number): BlackjackGame {
  const deck = shuffle(buildDeck());
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];
  return { deck, playerHand, dealerHand, bet, done: false };
}

export function hitPlayer(game: BlackjackGame): BlackjackGame {
  const card = game.deck.pop()!;
  return { ...game, playerHand: [...game.playerHand, card] };
}

export function dealerPlay(game: BlackjackGame): BlackjackGame {
  let { deck, dealerHand } = game;
  dealerHand = [...dealerHand];
  while (handTotal(dealerHand) < 17) {
    dealerHand.push(deck.pop()!);
  }
  return { ...game, deck, dealerHand, done: true };
}

export function resolveGame(game: BlackjackGame): BlackjackResult {
  const playerTotal = handTotal(game.playerHand);
  const dealerTotal = handTotal(game.dealerHand);

  // Natural blackjack on first deal (2 cards, total 21)
  if (game.playerHand.length === 2 && playerTotal === 21) return "blackjack";

  if (playerTotal > 21) return "lose";
  if (dealerTotal > 21) return "win";
  if (playerTotal > dealerTotal) return "win";
  if (playerTotal < dealerTotal) return "lose";
  return "push";
}

export function calculatePayout(bet: number, result: BlackjackResult): number {
  switch (result) {
    case "blackjack": return Math.floor(bet * 2.5); // 2.5× (net +1.5× bet)
    case "win": return bet * 2;                      // 2× (net +1× bet)
    case "push": return bet;                         // refund
    case "lose": return 0;
  }
}

export function resultEmoji(result: BlackjackResult): string {
  switch (result) {
    case "blackjack": return "🃏✨ BLACKJACK!";
    case "win": return "🏆 You win!";
    case "push": return "🤝 Push — bet refunded";
    case "lose": return "💀 Bust / Dealer wins";
  }
}
