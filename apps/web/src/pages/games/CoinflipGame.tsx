import { useState } from "react";
import { IslandButton, IslandCard, IslandTag, islandTagStyle } from "../../islandUi.js";
import { islandTheme } from "../../theme.js";
import { startCoinflip, type GameStateResponse } from "../../api/games.js";

type Props = {
  startBalance: number | null;
  maxBet: number;
  onResolved: (newBalance: number) => void;
  onBack: () => void;
};

export function CoinflipGame({ startBalance, maxBet, onResolved, onBack }: Props) {
  const [bet, setBet] = useState(10);
  const [call, setCall] = useState<"heads" | "tails">("heads");
  const [phase, setPhase] = useState<"idle" | "flipping" | "settled" | "error">("idle");
  const [result, setResult] = useState<GameStateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const balanceAvail = startBalance ?? 0;
  const validBet = Number.isInteger(bet) && bet >= 1 && bet <= Math.min(maxBet, balanceAvail);

  async function flip() {
    if (!validBet || phase === "flipping") return;
    setPhase("flipping");
    setErrorMsg(null);
    setResult(null);

    const res = await startCoinflip(bet, call);

    // Hold on the spinning animation a beat for drama.
    await wait(1200);

    if (!res.ok) {
      setErrorMsg(res.error.error);
      setPhase("error");
      return;
    }
    setResult(res.data);
    setPhase("settled");
    if (typeof res.data.newBalance === "number") onResolved(res.data.newBalance);
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
  }

  const r = result?.result?.type === "coinflip" ? result.result : null;
  const showOutcome = phase === "settled" && r;

  return (
    <IslandCard style={{ display: "grid", gap: 14, padding: 18 }}>
      <div style={headerStyle}>
        <div>
          <div className="island-display" style={{ fontSize: 18, fontWeight: 800 }}>Coinflip</div>
          <div style={{ fontSize: 12, color: islandTheme.color.textMuted }}>
            1.9× on win · 5% house edge · max bet {maxBet}
          </div>
        </div>
        <BackBtn onBack={onBack} />
      </div>

      {/* Coin */}
      <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
        <Coin
          face={showOutcome ? r!.outcome : "heads"}
          spinning={phase === "flipping"}
        />
      </div>

      {/* Outcome banner */}
      {showOutcome && r && (
        <div className="casino-result-enter" style={outcomeStyle(r.won)}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {r.won ? "🎉 You won!" : "😕 You lost"}
          </div>
          <div style={{ fontSize: 12, color: islandTheme.color.textSubtle, marginTop: 4 }}>
            Coin landed on <strong>{r.outcome}</strong> · you called <strong>{r.call}</strong>
            {" · "}
            {r.won ? `+${result!.payout! - result!.bet} Nuggies` : `-${result!.bet} Nuggies`}
            {result?.newBalance != null && ` · balance now ₦${result.newBalance.toLocaleString()}`}
          </div>
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div style={errorStyle}>{errorMsg}</div>
      )}

      {/* Controls */}
      {phase !== "settled" ? (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle}>Bet (Nuggies)</label>
            <input
              type="number"
              min={1}
              max={Math.min(maxBet, balanceAvail)}
              value={bet}
              onChange={(e) => setBet(parseInt(e.target.value, 10) || 0)}
              disabled={phase === "flipping"}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
              Balance: ₦{balanceAvail.toLocaleString()}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle}>Your call</label>
            <div style={{ display: "flex", gap: 8 }}>
              <CallChip active={call === "heads"} onClick={() => setCall("heads")} disabled={phase === "flipping"}>
                🪙 Heads
              </CallChip>
              <CallChip active={call === "tails"} onClick={() => setCall("tails")} disabled={phase === "flipping"}>
                🥏 Tails
              </CallChip>
            </div>
          </div>

          <IslandButton
            variant="primary"
            disabled={!validBet || phase === "flipping"}
            onClick={() => void flip()}
          >
            {phase === "flipping" ? "Flipping…" : `Flip for ₦${bet}`}
          </IslandButton>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <IslandButton variant="primary" onClick={reset}>Play again</IslandButton>
          <IslandButton variant="secondary" onClick={onBack}>Back to lobby</IslandButton>
        </div>
      )}
    </IslandCard>
  );
}

function Coin({ face, spinning }: { face: "heads" | "tails"; spinning: boolean }) {
  return (
    <div
      className={spinning ? "casino-coin-spinning" : ""}
      style={{
        width: 96,
        height: 96,
        borderRadius: "50%",
        background: face === "heads"
          ? "radial-gradient(circle at 35% 30%, #fef3c7, #fbbf24 60%, #b45309 100%)"
          : "radial-gradient(circle at 35% 30%, #e0e7ff, #94a3b8 60%, #475569 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 40,
        boxShadow: "0 0 24px rgba(251, 191, 36, 0.35), 0 12px 24px rgba(0, 0, 0, 0.4)"
      }}
    >
      {face === "heads" ? "🪙" : "🥏"}
    </div>
  );
}

function CallChip({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...islandTagStyle({ color: "#fbbf24", active }),
        padding: "6px 14px",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1
      }}
      className="island-mono"
    >
      {children}
    </button>
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

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12
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

function outcomeStyle(won: boolean): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 10,
    background: won ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.10)",
    border: `1px solid ${won ? "rgba(34, 197, 94, 0.30)" : "rgba(239, 68, 68, 0.30)"}`
  };
}

// Suppress TS unused-import noise
void IslandTag;
