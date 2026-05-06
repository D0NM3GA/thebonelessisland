import { useState } from "react";
import { IslandButton, IslandCard, islandTagStyle } from "../../islandUi.js";
import { islandTheme } from "../../theme.js";
import { startGuessNumber, type GameStateResponse } from "../../api/games.js";

type Props = {
  startBalance: number | null;
  maxBet: number;
  onResolved: (newBalance: number) => void;
  onBack: () => void;
};

export function GuessNumberGame({ startBalance, maxBet, onResolved, onBack }: Props) {
  const [bet, setBet] = useState(10);
  const [guess, setGuess] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "rolling" | "settled" | "error">("idle");
  const [result, setResult] = useState<GameStateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const balanceAvail = startBalance ?? 0;
  const validBet = Number.isInteger(bet) && bet >= 1 && bet <= Math.min(maxBet, balanceAvail);
  const canSubmit = validBet && guess !== null && phase !== "rolling";

  async function play() {
    if (!canSubmit || guess === null) return;
    setPhase("rolling");
    setErrorMsg(null);
    setResult(null);

    const res = await startGuessNumber(bet, guess);
    await wait(1000);

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
    setGuess(null);
  }

  const r = result?.result?.type === "guessnumber" ? result.result : null;
  const showOutcome = phase === "settled" && r;

  return (
    <IslandCard style={{ display: "grid", gap: 14, padding: 18 }}>
      <div style={headerStyle}>
        <div>
          <div className="island-display" style={{ fontSize: 18, fontWeight: 800 }}>Guess Number</div>
          <div style={{ fontSize: 12, color: islandTheme.color.textMuted }}>
            8× on win · pick 1–10 · max bet {maxBet}
          </div>
        </div>
        <BackBtn onBack={onBack} />
      </div>

      {/* Big reveal area */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "10px 0", height: 100 }}>
        {phase === "rolling" ? (
          <div className="casino-dice-rolling" style={dieStyle("#94a3b8")}>?</div>
        ) : showOutcome && r ? (
          <div className="casino-result-enter" style={dieStyle(r.won ? "#22c55e" : "#ef4444")}>
            {r.secret}
          </div>
        ) : (
          <div style={dieStyle("#475569")}>?</div>
        )}
      </div>

      {showOutcome && r && (
        <div className="casino-result-enter" style={outcomeStyle(r.won)}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {r.won ? "🎯 Bullseye!" : "🎯 Not this time"}
          </div>
          <div style={{ fontSize: 12, color: islandTheme.color.textSubtle, marginTop: 4 }}>
            Secret was <strong>{r.secret}</strong> · you guessed <strong>{r.guess}</strong>
            {" · "}
            {r.won ? `+${result!.payout! - result!.bet} Nuggies` : `-${result!.bet} Nuggies`}
            {result?.newBalance != null && ` · balance now ₦${result.newBalance.toLocaleString()}`}
          </div>
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div style={errorStyle}>{errorMsg}</div>
      )}

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
              disabled={phase === "rolling"}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
              Balance: ₦{balanceAvail.toLocaleString()}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle}>Pick a number</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGuess(n)}
                  disabled={phase === "rolling"}
                  style={numberBtnStyle(guess === n, phase === "rolling")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <IslandButton
            variant="primary"
            disabled={!canSubmit}
            onClick={() => void play()}
          >
            {phase === "rolling" ? "Rolling…" : guess === null ? "Pick a number" : `Guess ${guess} for ₦${bet}`}
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

function dieStyle(accent: string): React.CSSProperties {
  return {
    width: 90,
    height: 90,
    borderRadius: 16,
    background: `linear-gradient(155deg, ${accent}30 0%, ${accent}10 100%)`,
    border: `2px solid ${accent}`,
    color: accent,
    fontFamily: "var(--island-mono, monospace)",
    fontSize: 44,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 0 24px ${accent}40, 0 8px 18px rgba(0, 0, 0, 0.4)`
  };
}

function numberBtnStyle(selected: boolean, disabled: boolean): React.CSSProperties {
  return {
    ...islandTagStyle({ color: "#38bdf8", active: selected }),
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "var(--island-mono, monospace)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    justifyContent: "center"
  };
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
