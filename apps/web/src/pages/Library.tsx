import { useMemo, useState, type ReactNode } from "react";
import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type { PageId } from "../types.js";

type LibraryPageProps = {
  onNavigate: (page: PageId) => void;
};

type Owner = { initials: string; color: string; name: string };

type LibEntry = {
  id: string;
  title: string;
  category: "co-op" | "solo" | "party" | "puzzle" | "horror";
  art: string;
  cover: string;
  owners: Owner[];
  players: string;
  mine: boolean;
  tag: string;
};

const OWN_PALETTE = {
  jkraken: { initials: "JK", color: "#22d3ee", name: "jkraken" },
  aloha: { initials: "AL", color: "#ef8354", name: "aloha-pirate" },
  palm: { initials: "PA", color: "#86efac", name: "palmwave" },
  chef: { initials: "CH", color: "#fbbf24", name: "ChefNugget" },
  speedy: { initials: "SP", color: "#22d3ee", name: "SpeedyNugget" },
  dawson: { initials: "DA", color: "#f4a261", name: "dawson" },
  lore: { initials: "LO", color: "#a78bfa", name: "LoreNugget" },
  reef: { initials: "RE", color: "#94a3b8", name: "ReefTroll" }
} as const;

const LIBRARY: LibEntry[] = [
  { id: "drg", title: "Deep Rock Galactic", category: "co-op", art: "⛏️", cover: "linear-gradient(135deg,#064e3b,#0f172a)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.aloha, OWN_PALETTE.palm, OWN_PALETTE.chef, OWN_PALETTE.speedy], players: "4p", mine: true, tag: "co-op shooter" },
  { id: "hd2", title: "Helldivers II", category: "co-op", art: "🪖", cover: "linear-gradient(135deg,#1e3a8a,#0c4a6e)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.aloha, OWN_PALETTE.speedy, OWN_PALETTE.dawson, OWN_PALETTE.lore], players: "4p", mine: true, tag: "co-op shooter" },
  { id: "lc", title: "Lethal Company", category: "horror", art: "👻", cover: "linear-gradient(135deg,#052e16,#0f172a)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.aloha, OWN_PALETTE.palm, OWN_PALETTE.chef, OWN_PALETTE.speedy], players: "4p", mine: true, tag: "horror co-op" },
  { id: "dsd", title: "Deep Sea Dunkers", category: "co-op", art: "🐙", cover: "linear-gradient(135deg,#1e3a8a,#0c4a6e)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.palm, OWN_PALETTE.speedy, OWN_PALETTE.dawson, OWN_PALETTE.chef], players: "4p", mine: true, tag: "co-op horror" },
  { id: "cc", title: "Cosmic Cruiser", category: "co-op", art: "🚀", cover: "linear-gradient(135deg,#312e81,#0c4a6e)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.speedy, OWN_PALETTE.dawson, OWN_PALETTE.palm, OWN_PALETTE.aloha], players: "1-4", mine: true, tag: "arcade speedrun" },
  { id: "sdv", title: "Stardew Valley", category: "co-op", art: "🌽", cover: "linear-gradient(135deg,#166534,#14532d)", owners: [OWN_PALETTE.palm, OWN_PALETTE.dawson, OWN_PALETTE.chef, OWN_PALETTE.lore], players: "4p", mine: true, tag: "cozy co-op" },
  { id: "ckc", title: "Chef's Kitchen Chaos", category: "party", art: "🍳", cover: "linear-gradient(135deg,#7c2d12,#1c1917)", owners: [OWN_PALETTE.chef, OWN_PALETTE.dawson, OWN_PALETTE.palm, OWN_PALETTE.jkraken], players: "1-4", mine: true, tag: "co-op party" },
  { id: "nk", title: "Nugget Knight", category: "solo", art: "🛡️", cover: "linear-gradient(135deg,#4c1d95,#1e3a8a)", owners: [OWN_PALETTE.lore, OWN_PALETTE.dawson], players: "1p", mine: true, tag: "platformer" },
  { id: "drf", title: "Dorfromantik", category: "puzzle", art: "🌿", cover: "linear-gradient(135deg,#365314,#1a2e05)", owners: [OWN_PALETTE.palm, OWN_PALETTE.dawson, OWN_PALETTE.chef], players: "1p", mine: true, tag: "cozy puzzle" },
  { id: "wwhf", title: "We Were Here Forever", category: "puzzle", art: "🗝️", cover: "linear-gradient(135deg,#1e1b4b,#0f172a)", owners: [OWN_PALETTE.palm, OWN_PALETTE.dawson, OWN_PALETTE.lore], players: "2p", mine: true, tag: "co-op puzzle" },
  { id: "ror2", title: "Risk of Rain 2", category: "co-op", art: "⚡", cover: "linear-gradient(135deg,#831843,#0f172a)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.speedy, OWN_PALETTE.aloha, OWN_PALETTE.dawson], players: "4p", mine: true, tag: "roguelike co-op" },
  { id: "phasmo", title: "Phasmophobia", category: "horror", art: "👻", cover: "linear-gradient(135deg,#0f172a,#020617)", owners: [OWN_PALETTE.aloha, OWN_PALETTE.reef, OWN_PALETTE.dawson, OWN_PALETTE.jkraken], players: "4p", mine: true, tag: "horror co-op" },
  { id: "hades2", title: "Hades II", category: "solo", art: "🔥", cover: "linear-gradient(135deg,#7f1d1d,#0f172a)", owners: [OWN_PALETTE.dawson, OWN_PALETTE.lore, OWN_PALETTE.palm], players: "1p", mine: true, tag: "roguelike" },
  { id: "sot", title: "Sea of Thieves", category: "co-op", art: "🏴‍☠️", cover: "linear-gradient(135deg,#0c4a6e,#082f49)", owners: [OWN_PALETTE.aloha, OWN_PALETTE.jkraken, OWN_PALETTE.dawson, OWN_PALETTE.reef], players: "4p", mine: true, tag: "pirate co-op" },
  { id: "sts", title: "Slay the Spire", category: "solo", art: "🃏", cover: "linear-gradient(135deg,#312e81,#1e1b4b)", owners: [OWN_PALETTE.dawson, OWN_PALETTE.lore, OWN_PALETTE.speedy], players: "1p", mine: true, tag: "roguelike deck" },
  { id: "vs", title: "Vampire Survivors", category: "solo", art: "🦇", cover: "linear-gradient(135deg,#3b0764,#0f172a)", owners: [OWN_PALETTE.dawson, OWN_PALETTE.speedy, OWN_PALETTE.jkraken, OWN_PALETTE.chef], players: "1p", mine: true, tag: "roguelike arcade" },
  { id: "ow", title: "Outer Wilds", category: "solo", art: "🪐", cover: "linear-gradient(135deg,#1e1b4b,#0c4a6e)", owners: [OWN_PALETTE.dawson, OWN_PALETTE.palm], players: "1p", mine: true, tag: "exploration" },
  { id: "hk", title: "Hollow Knight", category: "solo", art: "🦋", cover: "linear-gradient(135deg,#1e1b4b,#0f172a)", owners: [OWN_PALETTE.dawson, OWN_PALETTE.lore, OWN_PALETTE.palm, OWN_PALETTE.speedy], players: "1p", mine: true, tag: "metroidvania" },
  { id: "amongus", title: "Among Us", category: "party", art: "👽", cover: "linear-gradient(135deg,#831843,#0f172a)", owners: [OWN_PALETTE.jkraken, OWN_PALETTE.aloha, OWN_PALETTE.palm, OWN_PALETTE.chef, OWN_PALETTE.speedy], players: "4-10", mine: true, tag: "social deduction" },
  { id: "itt", title: "It Takes Two", category: "co-op", art: "💞", cover: "linear-gradient(135deg,#581c87,#0c4a6e)", owners: [OWN_PALETTE.palm, OWN_PALETTE.dawson, OWN_PALETTE.chef, OWN_PALETTE.lore], players: "2p", mine: true, tag: "co-op platformer" },
  { id: "oc2", title: "Overcooked! 2", category: "party", art: "🍳", cover: "linear-gradient(135deg,#7c2d12,#431407)", owners: [OWN_PALETTE.chef, OWN_PALETTE.dawson, OWN_PALETTE.palm, OWN_PALETTE.jkraken, OWN_PALETTE.speedy], players: "1-4", mine: true, tag: "co-op party" }
];

type LibFilter = "all" | "mine" | "co-op" | "horror" | "puzzle" | "party" | "solo";
type SortMode = "owned" | "title" | "recent";

const FILTERS: Array<{ id: LibFilter; label: string; count?: (entries: LibEntry[]) => number }> = [
  { id: "all", label: "ALL" },
  { id: "mine", label: "MINE", count: (e) => e.filter((x) => x.mine).length },
  { id: "co-op", label: "CO-OP" },
  { id: "horror", label: "HORROR" },
  { id: "puzzle", label: "PUZZLE" },
  { id: "party", label: "PARTY" },
  { id: "solo", label: "SOLO" }
];

export function LibraryPage({ onNavigate }: LibraryPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LibFilter>("all");
  const [sort, setSort] = useState<SortMode>("owned");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    let out = LIBRARY.slice();
    if (filter === "mine") out = out.filter((e) => e.mine);
    else if (filter !== "all") out = out.filter((e) => e.category === filter);
    if (query) out = out.filter((e) => e.title.toLowerCase().includes(query) || e.tag.includes(query));
    if (sort === "owned") out.sort((a, b) => b.owners.length - a.owners.length || a.title.localeCompare(b.title));
    else if (sort === "title") out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }, [search, filter, sort]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          className="island-mono"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: islandTheme.color.textMuted
          }}
        >
          ★ Games · Library
        </span>
        <h1 className="island-display" style={{ margin: 0, fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800 }}>
          Steam library
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: islandTheme.color.textSubtle, maxWidth: 640 }}>
          All {LIBRARY.length} games shared across the crew, synced from Steam every 12 hours. Filter, search, jump
          straight into planning a session.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("games")}
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            color: islandTheme.color.primaryGlow,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
            font: "inherit"
          }}
        >
          ← Back to Games
        </button>
      </header>

      <IslandCard style={{ padding: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${LIBRARY.length} games…`}
          style={{
            flex: "1 1 280px",
            minWidth: 280,
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            background: islandTheme.color.panelMutedBg,
            color: islandTheme.color.textPrimary,
            fontFamily: islandTheme.font.mono,
            fontSize: 12,
            outline: "none"
          }}
        />
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.count ? f.count(LIBRARY) : null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="island-mono"
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? islandTheme.color.primaryGlow : islandTheme.color.cardBorder}`,
                background: active ? islandTheme.color.primaryGlow : islandTheme.color.panelMutedBg,
                color: active ? "#0f172a" : islandTheme.color.textMuted,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                font: "inherit"
              }}
            >
              {f.label}
              {count !== null ? ` · ${count}` : ""}
            </button>
          );
        })}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            background: islandTheme.color.panelMutedBg,
            color: islandTheme.color.textPrimary,
            fontSize: 12,
            font: "inherit"
          }}
        >
          <option value="owned">Most owned</option>
          <option value="title">Alphabetical</option>
          <option value="recent">Recently played</option>
        </select>
      </IslandCard>

      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <HeaderRow />
        {visible.length ? (
          visible.map((entry) => (
            <LibRow key={entry.id} entry={entry} onPlan={() => onNavigate("games")} />
          ))
        ) : (
          <div style={{ padding: 22, fontSize: 13, color: islandTheme.color.textMuted, textAlign: "center" }}>
            No games match your filter.
          </div>
        )}
      </IslandCard>
    </div>
  );
}

const COLUMNS = "60px 1.4fr 1fr 80px 80px auto";

function HeaderRow() {
  return (
    <div
      className="island-mono"
      style={{
        display: "grid",
        gridTemplateColumns: COLUMNS,
        gap: 14,
        padding: "10px 16px",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: islandTheme.color.textMuted,
        borderBottom: `1px solid ${islandTheme.color.cardBorder}`,
        background: islandTheme.color.panelMutedBg
      }}
    >
      <Cell />
      <Cell>Title</Cell>
      <Cell>Owners</Cell>
      <Cell>Count</Cell>
      <Cell>Players</Cell>
      <Cell />
    </div>
  );
}

function Cell({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

function LibRow({ entry, onPlan }: { entry: LibEntry; onPlan: () => void }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLUMNS,
        gap: 14,
        padding: "12px 16px",
        alignItems: "center",
        borderBottom: `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div
        style={{
          width: 60,
          height: 48,
          borderRadius: 6,
          background: entry.cover,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22
        }}
      >
        {entry.art}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {entry.title}
          {entry.mine ? (
            <span
              className="island-mono"
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(96, 165, 250, 0.22)",
                color: islandTheme.color.primaryGlow,
                marginLeft: 6,
                fontWeight: 700
              }}
            >
              ★ MINE
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: islandTheme.color.textMuted, marginTop: 2 }}>{entry.tag}</div>
      </div>
      <OwnerStack owners={entry.owners} />
      <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {entry.owners.length} own
      </span>
      <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {entry.players}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={onPlan}
          className="island-mono"
          style={{
            background: islandTheme.color.primary,
            border: `1px solid ${islandTheme.color.primary}`,
            color: islandTheme.color.primaryText,
            padding: "5px 10px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
            font: "inherit"
          }}
        >
          PLAN
        </button>
        <button
          type="button"
          className="island-mono"
          style={{
            background: "transparent",
            border: `1px solid ${islandTheme.color.cardBorder}`,
            color: islandTheme.color.textSubtle,
            padding: "5px 10px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            cursor: "pointer",
            font: "inherit"
          }}
        >
          DETAILS
        </button>
      </div>
    </div>
  );
}

function OwnerStack({ owners }: { owners: Owner[] }) {
  return (
    <div style={{ display: "inline-flex", paddingLeft: 6 }}>
      {owners.slice(0, 5).map((o, i) => (
        <span
          key={o.name + i}
          title={o.name}
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: o.color,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: "#0f172a",
            fontSize: 9,
            border: `2px solid ${islandTheme.color.panelMutedBg}`,
            marginLeft: -6
          }}
        >
          {o.initials}
        </span>
      ))}
      {owners.length > 5 ? (
        <span
          className="island-mono"
          style={{
            marginLeft: 4,
            fontSize: 10,
            color: islandTheme.color.textMuted,
            alignSelf: "center"
          }}
        >
          +{owners.length - 5}
        </span>
      ) : null}
    </div>
  );
}
