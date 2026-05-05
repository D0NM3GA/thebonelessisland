import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";

export function NuggiesPage() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 className="island-display" style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
          Nuggies <span style={{ fontSize: 26 }}>🍗</span>
        </h1>
        <div
          className="island-mono"
          style={{
            marginTop: 4,
            fontSize: 11,
            color: islandTheme.color.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em"
          }}
        >
          Island economy · earn, spend, flex
        </div>
      </div>

      {/* Balance card */}
      <IslandCard
        style={{
          background: `linear-gradient(135deg, rgba(251,191,119,0.18) 0%, ${islandTheme.color.panelBg} 100%)`,
          border: `1px solid rgba(251,191,119,0.3)`,
          padding: "28px 28px"
        }}
      >
        <div
          className="island-mono"
          style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#fbbf77", marginBottom: 10 }}
        >
          Your balance
        </div>
        <div
          className="island-display"
          style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 6 }}
        >
          —
        </div>
        <div style={{ fontSize: 13, color: islandTheme.color.textSubtle }}>
          Economy launches soon. Get ready to stack some nuggies.
        </div>
      </IslandCard>

      {/* Upcoming features */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12
        }}
      >
        {UPCOMING.map((item) => (
          <IslandCard key={item.title} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
              {item.body}
            </div>
            <div
              className="island-mono"
              style={{
                marginTop: 10,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: islandTheme.color.textMuted
              }}
            >
              Coming soon
            </div>
          </IslandCard>
        ))}
      </div>
    </div>
  );
}

const UPCOMING = [
  {
    icon: "📅",
    title: "Daily claim",
    body: "Log in each day and claim your Nuggies. Streaks may reward bonus drops."
  },
  {
    icon: "🌴",
    title: "Game night attendance",
    body: "Show up to game night and earn. No grind — just showing up."
  },
  {
    icon: "🏪",
    title: "Shop",
    body: "Spend Nuggies on titles, badges, and crew flair. Purely cosmetic — no P2W."
  },
  {
    icon: "🎲",
    title: "Games",
    body: "Coin flips, blackjack, and more. Risk your Nuggies for a shot at doubling them."
  },
  {
    icon: "🤝",
    title: "Trade",
    body: "Send Nuggies to other crew members. Tipping, gifts, or just vibes."
  },
  {
    icon: "🏆",
    title: "Milestones",
    body: "Reach Nuggie thresholds to unlock milestone badges. Bragging rights included."
  }
];
