import { useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import { IslandCard } from "../islandUi.js";
import { NuggieBadge } from "../components/NuggieBadge.js";
import { islandTheme } from "../theme.js";
import type { NuggiesLeaderboardEntry, PageId } from "../types.js";

type CommunityLeaderboardPageProps = {
  onNavigate: (page: PageId) => void;
};

export default function CommunityLeaderboardPage({ onNavigate }: CommunityLeaderboardPageProps) {
  const [leaderboard, setLeaderboard] = useState<NuggiesLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void apiFetch("/nuggies/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { leaderboard: NuggiesLeaderboardEntry[] } | null) => {
        if (!active) return;
        if (d?.leaderboard) setLeaderboard(d.leaderboard);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          className="island-mono"
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: islandTheme.color.textMuted
          }}
        >
          ★ Community · Leaderboard
        </span>
        <h1 className="island-display" style={{ margin: 0, fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800 }}>
          Top Islanders
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: islandTheme.color.textSubtle, maxWidth: 640 }}>
          Who's hoarding the most Nuggies on the island. Earn, gamble, and climb the ladder.
        </p>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("community");
          }}
          style={{ color: islandTheme.color.primaryGlow, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          ← Back to Community
        </a>
      </header>

      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "20px 16px", fontSize: 13, color: islandTheme.color.textMuted, textAlign: "center" }}>
            Counting Nuggies…
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: "20px 16px", fontSize: 13, color: islandTheme.color.textMuted, textAlign: "center" }}>
            No islanders on the ladder yet. Go earn some Nuggies!
          </div>
        ) : (
          leaderboard.map((entry, i) => <LeaderRow key={entry.discordUserId} entry={entry} firstRow={i === 0} />)
        )}
      </IslandCard>
    </div>
  );
}

function LeaderRow({ entry, firstRow }: { entry: NuggiesLeaderboardEntry; firstRow: boolean }) {
  const rankLabel = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 40px 1fr auto",
        gap: 12,
        padding: "12px 16px",
        alignItems: "center",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div
        className="island-display"
        style={{
          fontWeight: 800,
          fontSize: 18,
          textAlign: "center",
          color: entry.rank <= 3 ? islandTheme.palette.sandWarmAccent : islandTheme.color.textMuted
        }}
      >
        {rankLabel}
      </div>
      {entry.avatarUrl ? (
        <img src={entry.avatarUrl} alt="" width={40} height={40} style={{ borderRadius: 999 }} />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: islandTheme.color.panelMutedBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: islandTheme.color.textMuted,
            fontSize: 13
          }}
        >
          {entry.username.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.username}
        </div>
        {entry.equippedTitle && (
          <div style={{ marginTop: 2 }}>
            <NuggieBadge
              item={{ ...entry.equippedTitle, itemType: entry.equippedTitle.itemType as "title" | "flair" | "badge" }}
              size="sm"
            />
          </div>
        )}
      </div>
      <span
        className="island-mono"
        style={{ fontWeight: 700, fontSize: 14, color: islandTheme.palette.sandWarmAccent, whiteSpace: "nowrap" }}
      >
        ₦{entry.balance.toLocaleString()}
      </span>
    </div>
  );
}
