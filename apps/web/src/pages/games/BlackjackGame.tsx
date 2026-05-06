import { useEffect, useState } from "react";
import { IslandButton, IslandCard } from "../../islandUi.js";
import { islandTheme } from "../../theme.js";
import {
  blackjackResultLabel,
  blackjackStep,
  getActiveGameSession,
  startBlackjack,
  type Card,
  type GameStateResponse
} from "../../api/games.js";

type Props = {
  startBalance: number | null;
  maxBet: number;
  initialState: GameStateResponse | null; // resume support
  onResolved: (newBalance: number) => void;
  onBack: () => void;
};

type Phase = "idle" | "starting" | "active" | "stepping" | "settled" | "error";

export function BlackjackGame({ startBalance, maxBet, initialState, onResolved, onBack }: Props) {
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState<Phase>(() => (initialState && initialState.status === "active" ? "active" : "idle"));
  const [state, setState] = useState<GameStateResponse | null>(initialState);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const balanceAvail = startBalance ?? 0;
  const validBet = Number.isInteger(bet) && bet >= 1 && bet <= Math.min(maxBet, balanceAvail);

  // Poll for state changes while active (keeps in sync if user also has bot view)
  useEffect(() => {
    if (phase !== "active") return;
    let cancelled = false;
    const id = setInterval(async () => {
      const res = await getActiveGameSession();
      if (cancelled) return;
      if (!res.ok) return;
      if (res.data.active === null) {
        // Hand resolved elsewhere — refresh to settled view via best-effort.
        setPhase("idle");
        setState(null);
        return;
      }
      setState(res.data.active);
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase]);

  async function deal() {
    if (!validBet || phase === "starting") return;
    setPhase("starting");
    setErrorMsg(null);
    const res = await startBlackjack(bet);
    if (!res.ok) {
      setErrorMsg(res.error.error);
      setPhase("error");
      return;
    }
    setState(res.data);
    if (res.data.status === "resolved") {
      setPhase("settled");
      if (typeof res.data.newBalance === "number") onResolved(res.data.newBalance);
    } else {
      setPhase("active");
    }
  }

  async function step(action: "hit" | "stand") {
    if (!state || phase === "stepping") return;
    setPhase("stepping");
    setErrorMsg(null);
    const res = await blackjackStep(state.sessionId, action);
    if (!res.ok) {
      setErrorMsg(res.error.error);
      setPhase("error");
      return;
    }
    setState(res.data);
    if (res.data.status === "resolved") {
      setPhase("settled");
      if (typeof res.data.newBalance === "number") onResolved(res.data.newBalance);
    } else {
      setPhase("active");
    }
  }

  function reset() {
    setPhase("idle");
    setState(null);
    setErrorMsg(null);
  }

  return (
    <IslandCard style={{ display: "grid", gap: 14, padding: 18 }}>
      <div style={headerStyle}>
        <div>
          <div className="island-display" style={{ fontSize: 18, fontWeight: 800 }}>Blackjack</div>
          <div style={{ fontSize: 12, color: islandTheme.color.textMuted }}>
            Dealer hits to 17 · Blackjack pays 2.5× · auto-stand after 60s · max bet {maxBet}
          </div>
        </div>
        <BackBtn onBack={onBack} />
      </div>

      {/* Dealer */}
      {state && (
        <div style={tableStyle}>
          <SeatLabel>Dealer</SeatLabel>
          <CardRow
            cards={state.data.dealerHand ?? []}
            hidden={phase === "active" || phase === "stepping" ? state.data.dealerHidden ?? 0 : 0}
            total={
              state.status === "resolved"
                ? state.data.dealerTotal
                : state.data.dealerVisibleTotal
            }
            isDealer
          />
        </div>
      )}

      {/* Player */}
      {state && (
        <div style={tableStyle}>
          <SeatLabel>You</SeatLabel>
          <CardRow
            cards={state.data.playerHand ?? []}
            hidden={0}
            total={state.data.playerTotal}
          />
        </div>
      )}

      {/* Outcome banner */}
      {phase === "settled" && state?.result?.type === "blackjack" && (
        <div className="casino-result-enter" style={outcomeStyle(state.result.result)}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {state.result.result === "blackjack" && "🃏✨ "}
            {blackjackResultLabel(state.result.result)}
          </div>
          <div style={{ fontSize: 12, color: islandTheme.color.textSubtle, marginTop: 4 }}>
            {payoutNote(state)}
            {state.newBalance != null && ` · balance now ₦${state.newBalance.toLocaleString()}`}
          </div>
        </div>
      )}

      {phase === "error" && errorMsg && <div style={errorStyle}>{errorMsg}</div>}

      {/* Controls */}
      {phase === "idle" || phase === "error" ? (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle}>Bet (Nuggies)</label>
            <input
              type="number"
              min={1}
              max={Math.min(maxBet, balanceAvail)}
              value={bet}
              onChange={(e) => setBet(parseInt(e.target.value, 10) || 0)}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
              Balance: ₦{balanceAvail.toLocaleString()}
            </div>
          </div>
          <IslandButton variant="primary" disabled={!validBet} onClick={() => void deal()}>
            Deal
          </IslandButton>
        </>
      ) : phase === "starting" ? (
        <div style={{ fontSize: 13, color: islandTheme.color.textMuted, textAlign: "center" }}>
          Shuffling…
        </div>
      ) : phase === "active" || phase === "stepping" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <IslandButton
            variant="primary"
            disabled={phase === "stepping"}
            onClick={() => void step("hit")}
            style={{ flex: 1 }}
          >
            {phase === "stepping" ? "…" : "Hit"}
          </IslandButton>
          <IslandButton
            variant="secondary"
            disabled={phase === "stepping"}
            onClick={() => void step("stand")}
            style={{ flex: 1 }}
          >
            Stand
          </IslandButton>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <IslandButton variant="primary" onClick={reset}>New hand</IslandButton>
          <IslandButton variant="secondary" onClick={onBack}>Back to lobby</IslandButton>
        </div>
      )}
    </IslandCard>
  );
}

function payoutNote(state: GameStateResponse): string {
  const payout = state.payout ?? 0;
  if (payout > state.bet) return `+${payout - state.bet} Nuggies`;
  if (payout === state.bet) return `bet refunded`;
  return `-${state.bet - payout} Nuggies`;
}

function SeatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="island-mono"
      style={{
        fontSize: 11,
        color: islandTheme.color.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 6
      }}
    >
      {children}
    </div>
  );
}

function CardRow({
  cards,
  hidden,
  total,
  isDealer = false
}: {
  cards: Card[];
  hidden: number;
  total?: number;
  isDealer?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flex: 1 }}>
        {cards.map((c, i) => <CardView key={`${c.rank}${c.suit}-${i}`} card={c} />)}
        {Array.from({ length: hidden }).map((_, i) => <CardView key={`hidden-${i}`} hidden />)}
      </div>
      {typeof total === "number" && total > 0 && (
        <div
          className="island-mono"
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: total > 21 ? islandTheme.color.dangerAccent : isDealer ? "#fbbf77" : islandTheme.color.textPrimary
          }}
        >
          {total}{total > 21 ? " bust" : ""}
        </div>
      )}
    </div>
  );
}

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
    return <div className="casino-card hidden casino-card-enter">??</div>;
  }
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div className={`casino-card ${isRed ? "red" : ""} casino-card-enter`}>
      <span className="rank">{card.rank}</span>
      <span className="suit">{card.suit}</span>
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="island-mono"
      style={{
        background: "transparent",
        border: "none",
        color: islandTheme.color.textMuted,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
        font: "inherit"
      }}
    >
      ← Lobby
    </button>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12
};

const tableStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(15, 42, 40, 0.4)",
  border: "1px solid rgba(34, 197, 94, 0.18)",
  minHeight: 96
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: islandTheme.color.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontFamily: "var(--island-mono, monospace)"
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${islandTheme.color.cardBorder}`,
  background: islandTheme.color.panelMutedBg,
  color: islandTheme.color.textPrimary,
  fontSize: 14,
  font: "inherit"
};

const errorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "rgba(239, 68, 68, 0.10)",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  color: "#fca5a5",
  fontSize: 13
};

function outcomeStyle(result: "win" | "lose" | "push" | "blackjack"): React.CSSProperties {
  const win = result === "win" || result === "blackjack";
  const push = result === "push";
  return {
    padding: "12px 14px",
    borderRadius: 10,
    background: win ? "rgba(34, 197, 94, 0.12)" : push ? "rgba(245, 158, 11, 0.10)" : "rgba(239, 68, 68, 0.10)",
    border: `1px solid ${win ? "rgba(34, 197, 94, 0.30)" : push ? "rgba(245, 158, 11, 0.30)" : "rgba(239, 68, 68, 0.30)"}`
  };
}
