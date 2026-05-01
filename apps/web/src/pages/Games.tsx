import { useMemo, useState, type ReactNode } from "react";
import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type { GameNight, GameNightAttendee, GuildMember, PageId } from "../types.js";

type GamesPageProps = {
  gameNights: GameNight[];
  selectedNight: GameNight | null;
  selectedNightId: number | null;
  nightAttendees: GameNightAttendee[];
  filteredGuildMembers: GuildMember[];
  selectedMemberIds: string[];
  newNightTitle: string;
  newNightScheduledFor: string;
  currentUserAttendingSelectedNight: boolean;
  onSelectNight: (id: number, title: string) => void;
  onNewNightTitleChange: (value: string) => void;
  onNewNightScheduledForChange: (value: string) => void;
  onToggleSelectedMember: (discordUserId: string) => void;
  onCreateGameNight: () => void;
  onJoinSelectedNight: () => void;
  onLeaveSelectedNight: () => void;
  onAddSelectedMembersToNight: () => void;
  onRemoveSelectedMembersFromNight: () => void;
  onNavigate: (page: PageId) => void;
};

export function GamesPage(props: GamesPageProps) {
  return (
    <div style={{ display: "grid", gap: 24, position: "relative" }}>
      <GamesHero />
      <SessionAndPatchesRow {...props} />
      <ScheduledNights {...props} />
      <GroupWishlist />
      <LibrarySnapshot onNavigate={props.onNavigate} />
      <StreamDrawer />
    </div>
  );
}

function GamesHero() {
  return (
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
        Plan a session · pick a game · invite the crew
      </span>
      <h1 className="island-display" style={{ margin: 0, fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800 }}>
        Games
      </h1>
    </header>
  );
}

function SessionAndPatchesRow(props: GamesPageProps) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 16,
        alignItems: "start"
      }}
    >
      <SessionComposer {...props} />
      <PatchesRolodex />
    </section>
  );
}

const AI_MODES = ["Tonight", "Weekend", "Quick", "Cozy", "Spicy"] as const;
type AIMode = (typeof AI_MODES)[number];

const AI_PICK = {
  title: "Deep Rock Galactic",
  matchPct: 92,
  reason:
    "Six of you own it, four are in voice now, and the last three sessions averaged 78 minutes — perfect for tonight's window.",
  cover: "linear-gradient(135deg,#1e1b4b 0%,#7c2d12 100%)",
  stats: [
    { k: "crew own", v: "6 / 8" },
    { k: "in voice", v: "4" },
    { k: "avg session", v: "78m" },
    { k: "ping", v: "42ms" },
    { k: "last played", v: "9d ago" }
  ]
};

function SessionComposer(props: GamesPageProps) {
  const [mode, setMode] = useState<AIMode>("Tonight");

  return (
    <IslandCard style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: `1px solid ${islandTheme.color.cardBorder}`,
          display: "flex",
          alignItems: "center",
          gap: 12
        }}
      >
        <span
          className="island-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(96, 165, 250, 0.18)",
            color: islandTheme.color.primaryGlow
          }}
        >
          ★ AI pick
        </span>
        <span style={{ fontSize: 12, color: islandTheme.color.textMuted }}>
          Match strength <strong style={{ color: islandTheme.color.textPrimary }}>{AI_PICK.matchPct}%</strong>
        </span>
        <button
          type="button"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: `1px solid ${islandTheme.color.cardBorder}`,
            color: islandTheme.color.textSubtle,
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 999,
            cursor: "pointer",
            font: "inherit"
          }}
        >
          Tune weights
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, padding: 16 }}>
        <div
          style={{
            width: 96,
            height: 128,
            borderRadius: 10,
            background: AI_PICK.cover,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            display: "flex",
            alignItems: "flex-end",
            padding: 6,
            color: "#fff",
            fontSize: 10,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            fontWeight: 700
          }}
        >
          DRG
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 className="island-display" style={{ margin: "2px 0 4px", fontSize: 22, fontWeight: 800 }}>
            {AI_PICK.title}
          </h2>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: islandTheme.color.textSubtle }}>
            {AI_PICK.reason}
          </p>
          <ModeBar value={mode} onChange={setMode} />
          <StatStrip stats={AI_PICK.stats} />
        </div>
      </div>

      <RosterPicker {...props} />
      <WhenWhereStrip />
      <SessionFooter />
    </IslandCard>
  );
}

function ModeBar({ value, onChange }: { value: AIMode; onChange: (m: AIMode) => void }) {
  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        gap: 0,
        borderBottom: `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      {AI_MODES.map((m) => {
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              padding: "8px 12px",
              border: "none",
              background: "transparent",
              color: active ? islandTheme.color.textPrimary : islandTheme.color.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              borderBottom: active
                ? `2px solid ${islandTheme.color.primaryGlow}`
                : "2px solid transparent",
              marginBottom: -1,
              font: "inherit"
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

function StatStrip({ stats }: { stats: Array<{ k: string; v: string }> }) {
  return (
    <div
      style={{
        marginTop: 12,
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        borderRadius: 10,
        overflow: "hidden",
        background: islandTheme.color.panelMutedBg
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.k}
          style={{
            padding: "8px 10px",
            borderRight: i < stats.length - 1 ? `1px solid ${islandTheme.color.cardBorder}` : "none",
            textAlign: "left"
          }}
        >
          <div
            className="island-mono"
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: islandTheme.color.textMuted
            }}
          >
            {s.k}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}

function RosterPicker({
  filteredGuildMembers,
  selectedMemberIds,
  onToggleSelectedMember
}: GamesPageProps) {
  const display = filteredGuildMembers.slice(0, 8);
  const ready = selectedMemberIds.length;
  return (
    <div
      style={{
        borderTop: `1px solid ${islandTheme.color.cardBorder}`,
        padding: "12px 16px"
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span
          className="island-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: islandTheme.color.textMuted
          }}
        >
          Crew roster
        </span>
        <span style={{ fontSize: 12, color: islandTheme.color.textPrimary, fontWeight: 700 }}>
          {ready} ready
        </span>
        <span style={{ fontSize: 11, color: islandTheme.color.textMuted, marginLeft: "auto" }}>
          tap to add to invite
        </span>
      </div>
      {display.length ? (
        <div style={{ display: "grid", gap: 4 }}>
          {display.map((m) => {
            const selected = selectedMemberIds.includes(m.discordUserId);
            const status = m.inVoice ? "voice" : m.richPresenceText ? "online" : "idle";
            const dotColor =
              status === "voice"
                ? "#4ade80"
                : status === "online"
                  ? islandTheme.color.primaryGlow
                  : islandTheme.color.textMuted;
            return (
              <button
                key={m.discordUserId}
                type="button"
                onClick={() => onToggleSelectedMember(m.discordUserId)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "16px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: selected
                    ? `1px solid ${islandTheme.color.primaryGlow}`
                    : `1px solid transparent`,
                  background: selected ? "rgba(96, 165, 250, 0.12)" : "transparent",
                  color: islandTheme.color.textPrimary,
                  cursor: "pointer",
                  font: "inherit"
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  style={{ pointerEvents: "none" }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {m.displayName}
                </span>
                <span
                  className="island-mono"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: dotColor,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }} />
                  {status}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>No crew loaded yet.</p>
      )}
    </div>
  );
}

function WhenWhereStrip() {
  const [time, setTime] = useState("Now");
  const [channel, setChannel] = useState("Lagoon Lounge");
  return (
    <div
      style={{
        borderTop: `1px solid ${islandTheme.color.cardBorder}`,
        padding: "10px 16px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12
      }}
    >
      <MetaCell label="When" value={time}>
        {["Now", "9pm", "10pm", "Tmrw"].map((t) => (
          <QuickChip key={t} active={t === time} onClick={() => setTime(t)}>
            {t}
          </QuickChip>
        ))}
      </MetaCell>
      <MetaCell label="Where" value={channel}>
        {["Lagoon Lounge", "Beach Hut", "Reef Stage"].map((c) => (
          <QuickChip key={c} active={c === channel} onClick={() => setChannel(c)}>
            {c}
          </QuickChip>
        ))}
      </MetaCell>
    </div>
  );
}

function MetaCell({
  label,
  value,
  children
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          className="island-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: islandTheme.color.textMuted
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function QuickChip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${active ? islandTheme.color.primaryGlow : islandTheme.color.cardBorder}`,
        background: active ? "rgba(96, 165, 250, 0.18)" : "transparent",
        color: active ? islandTheme.color.textPrimary : islandTheme.color.textSubtle,
        cursor: "pointer",
        font: "inherit"
      }}
    >
      {children}
    </button>
  );
}

function SessionFooter() {
  return (
    <div
      style={{
        borderTop: `1px solid ${islandTheme.color.cardBorder}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: islandTheme.color.textSubtle
        }}
      >
        <input type="checkbox" defaultChecked /> Ping crew
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: islandTheme.color.textSubtle
        }}
      >
        <input type="checkbox" /> Calendar event
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: islandTheme.color.textSubtle
        }}
      >
        <input type="checkbox" /> Auto DM no-shows
      </label>
      <button
        type="button"
        style={{
          marginLeft: "auto",
          background: islandTheme.color.primary,
          border: `1px solid ${islandTheme.color.primary}`,
          color: islandTheme.color.primaryText,
          padding: "8px 18px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          font: "inherit"
        }}
      >
        Send invite →
      </button>
    </div>
  );
}

type Patch = {
  id: string;
  game: string;
  title: string;
  size: string;
  ago: string;
  kind: "patch" | "dlc" | "blog" | "roadmap" | "sale";
  scope: "library" | "wishlist" | "crew";
  rationale: string;
  icon: string;
};

const PATCH_FEATURED: Patch = {
  id: "feat",
  game: "Helldivers II",
  title: "Major Order: the Squid Front opens up",
  size: "2.1 GB",
  ago: "5h ago",
  kind: "patch",
  scope: "crew",
  rationale: "5 of your crew own it; new modifiers reset weekly.",
  icon: "🦑"
};

const PATCH_LIST: Patch[] = [
  { id: "p1", game: "Deep Rock Galactic", title: "Season 6 teaser — Molly upgrade", size: "—", ago: "1d ago", kind: "blog", scope: "library", rationale: "Active crew title — patch lands next month.", icon: "⛏️" },
  { id: "p2", game: "Stardew Valley", title: "1.6.9 patch — bug fixes + cozy", size: "180 MB", ago: "2d ago", kind: "patch", scope: "library", rationale: "Won't break saves. 3 of you have hours logged this week.", icon: "🌾" },
  { id: "p3", game: "Lethal Company", title: "V60 — new moon, new ways to die", size: "640 MB", ago: "3d ago", kind: "patch", scope: "crew", rationale: "Multiplayer-affecting; sync with crew before play.", icon: "👻" },
  { id: "p4", game: "Risk of Rain Returns", title: "DLC roadmap leak", size: "—", ago: "5d ago", kind: "roadmap", scope: "wishlist", rationale: "Two of you wishlisted last month.", icon: "🧨" },
  { id: "p5", game: "Cyberpunk 2077", title: "Spring sale — 60% off", size: "—", ago: "today", kind: "sale", scope: "wishlist", rationale: "On 4 wishlists; first sale since holidays.", icon: "💸" },
  { id: "p6", game: "Rust", title: "Steam Deck shoreline build", size: "1.4 GB", ago: "4d ago", kind: "patch", scope: "library", rationale: "Performance pass for low-power play.", icon: "🌊" }
];

type PatchScope = "all" | "library" | "wishlist" | "crew";

function PatchesRolodex() {
  const [scope, setScope] = useState<PatchScope>("all");
  const visible = useMemo(
    () => (scope === "all" ? PATCH_LIST : PATCH_LIST.filter((p) => p.scope === scope)),
    [scope]
  );

  return (
    <IslandCard
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 90,
        maxHeight: "calc(100vh - 110px)"
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${islandTheme.color.cardBorder}`,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <h3 className="island-display" style={{ margin: 0, fontSize: 15 }}>
          Patches & Updates
        </h3>
        <span style={{ fontSize: 11, color: islandTheme.color.textMuted, marginLeft: "auto" }}>
          curated for your library
        </span>
      </div>

      <PatchFeatured patch={PATCH_FEATURED} />

      <div
        style={{
          padding: "8px 12px",
          borderTop: `1px solid ${islandTheme.color.cardBorder}`,
          borderBottom: `1px solid ${islandTheme.color.cardBorder}`,
          display: "flex",
          gap: 4,
          flexWrap: "wrap"
        }}
      >
        {(["all", "library", "wishlist", "crew"] as PatchScope[]).map((s) => (
          <QuickChip key={s} active={s === scope} onClick={() => setScope(s)}>
            {s}
          </QuickChip>
        ))}
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {visible.map((p, i) => (
          <PatchRow key={p.id} patch={p} firstRow={i === 0} />
        ))}
        {visible.length === 0 ? (
          <div style={{ padding: 14, fontSize: 13, color: islandTheme.color.textMuted }}>
            No matching patches.
          </div>
        ) : null}
      </div>
    </IslandCard>
  );
}

function PatchFeatured({ patch }: { patch: Patch }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "44px 1fr",
        gap: 10,
        background:
          "linear-gradient(135deg, rgba(96, 165, 250, 0.18), rgba(96, 165, 250, 0))"
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: islandTheme.color.panelMutedBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22
        }}
      >
        {patch.icon}
      </div>
      <div>
        <div
          className="island-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: islandTheme.color.primaryGlow
          }}
        >
          ★ Featured · {patch.game}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{patch.title}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: islandTheme.color.textSubtle, lineHeight: 1.4 }}>
          {patch.rationale}
        </div>
        <div
          className="island-mono"
          style={{
            marginTop: 6,
            display: "flex",
            gap: 10,
            fontSize: 11,
            color: islandTheme.color.textMuted
          }}
        >
          <span>{patch.kind}</span>
          <span>·</span>
          <span>{patch.size}</span>
          <span>·</span>
          <span>{patch.ago}</span>
        </div>
      </div>
    </div>
  );
}

function PatchRow({ patch, firstRow }: { patch: Patch; firstRow: boolean }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        gap: 10,
        alignItems: "center",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: islandTheme.color.panelMutedBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16
        }}
      >
        {patch.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {patch.game} — {patch.title}
        </div>
        <div className="island-mono" style={{ fontSize: 10, color: islandTheme.color.textMuted, marginTop: 2 }}>
          {patch.kind} · {patch.size} · {patch.ago}
        </div>
      </div>
      <button
        type="button"
        style={{
          background: "transparent",
          border: "none",
          color: islandTheme.color.textMuted,
          cursor: "pointer",
          fontSize: 14,
          padding: 4
        }}
        aria-label="Mute patch"
      >
        🔕
      </button>
    </div>
  );
}

function ScheduledNights({
  gameNights,
  selectedNightId,
  selectedNight,
  currentUserAttendingSelectedNight,
  newNightTitle,
  newNightScheduledFor,
  onSelectNight,
  onNewNightTitleChange,
  onNewNightScheduledForChange,
  onCreateGameNight,
  onJoinSelectedNight,
  onLeaveSelectedNight
}: GamesPageProps) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <SectionHead
        title="Scheduled game nights"
        meta="Hosts pick the game. RSVP to lock in a seat — no voting, no vibes lost."
      />
      <CreateNightStrip
        title={newNightTitle}
        scheduledFor={newNightScheduledFor}
        onTitleChange={onNewNightTitleChange}
        onScheduledForChange={onNewNightScheduledForChange}
        onCreate={onCreateGameNight}
      />
      {gameNights.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12
          }}
        >
          {gameNights.map((night) => (
            <NightCard
              key={night.id}
              night={night}
              isSelected={selectedNightId === night.id}
              onSelect={() => onSelectNight(night.id, night.title)}
            />
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>No nights scheduled yet.</p>
      )}
      {selectedNight ? (
        <SelectedNightDetail
          night={selectedNight}
          currentUserAttending={currentUserAttendingSelectedNight}
          onJoin={onJoinSelectedNight}
          onLeave={onLeaveSelectedNight}
        />
      ) : null}
    </section>
  );
}

function CreateNightStrip({
  title,
  scheduledFor,
  onTitleChange,
  onScheduledForChange,
  onCreate
}: {
  title: string;
  scheduledFor: string;
  onTitleChange: (v: string) => void;
  onScheduledForChange: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <IslandCard style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span
        className="island-mono"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: islandTheme.color.textMuted
        }}
      >
        New
      </span>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Friday Island Session"
        style={{
          flex: "1 1 220px",
          minWidth: 220,
          padding: "6px 10px",
          borderRadius: 999,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          background: islandTheme.color.panelMutedBg,
          color: islandTheme.color.textPrimary,
          fontSize: 13,
          font: "inherit",
          outline: "none"
        }}
      />
      <input
        type="datetime-local"
        value={scheduledFor}
        onChange={(e) => onScheduledForChange(e.target.value)}
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          background: islandTheme.color.panelMutedBg,
          color: islandTheme.color.textPrimary,
          fontSize: 13,
          font: "inherit",
          outline: "none"
        }}
      />
      <button
        type="button"
        onClick={onCreate}
        style={{
          background: islandTheme.color.primary,
          border: `1px solid ${islandTheme.color.primary}`,
          color: islandTheme.color.primaryText,
          padding: "7px 14px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          font: "inherit"
        }}
      >
        Drop a night
      </button>
    </IslandCard>
  );
}

function NightCard({
  night,
  isSelected,
  onSelect
}: {
  night: GameNight;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: "left",
        background: islandTheme.color.panelBg,
        backdropFilter: islandTheme.glass.blur,
        WebkitBackdropFilter: islandTheme.glass.blur,
        border: isSelected
          ? `1px solid ${islandTheme.color.primaryGlow}`
          : `1px solid ${islandTheme.color.cardBorder}`,
        borderRadius: 14,
        padding: 14,
        cursor: "pointer",
        font: "inherit",
        color: islandTheme.color.textPrimary,
        boxShadow: isSelected ? "0 0 0 1px rgba(96,165,250,0.5), 0 6px 20px rgba(0,0,0,0.3)" : "none"
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{night.title}</div>
      <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {formatNightDate(night.scheduledFor)}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: islandTheme.color.textSubtle
        }}
      >
        {night.selectedGameName ? (
          <span>
            🎮 <strong style={{ color: islandTheme.color.textPrimary }}>{night.selectedGameName}</strong>
          </span>
        ) : (
          <span style={{ color: islandTheme.color.textMuted }}>Host hasn't picked yet</span>
        )}
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 6,
          flexWrap: "wrap"
        }}
      >
        <Pill tone={night.currentUserAttending ? "success" : "muted"}>
          {night.currentUserAttending ? "You're in" : "Not joined"}
        </Pill>
        <Pill tone="muted">{night.attendeeCount} crew</Pill>
      </div>
    </button>
  );
}

function SelectedNightDetail({
  night,
  currentUserAttending,
  onJoin,
  onLeave
}: {
  night: GameNight;
  currentUserAttending: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  return (
    <IslandCard style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 className="island-display" style={{ margin: 0, fontSize: 18 }}>
          {night.title}
        </h3>
        <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
          {formatNightDate(night.scheduledFor)}
        </span>
        <button
          type="button"
          onClick={currentUserAttending ? onLeave : onJoin}
          style={{
            marginLeft: "auto",
            background: currentUserAttending ? "transparent" : islandTheme.color.primary,
            border: `1px solid ${currentUserAttending ? "#7f1d1d" : islandTheme.color.primary}`,
            color: currentUserAttending ? "#fca5a5" : islandTheme.color.primaryText,
            padding: "7px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            font: "inherit"
          }}
        >
          {currentUserAttending ? "Leave" : "RSVP"}
        </button>
      </div>
      <div style={{ fontSize: 13, color: islandTheme.color.textSubtle }}>
        {night.selectedGameName ? (
          <>Tonight's pick: <strong>{night.selectedGameName}</strong></>
        ) : (
          <span style={{ color: islandTheme.color.textMuted }}>Host hasn't locked a game yet.</span>
        )}
      </div>
      <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {night.attendeeCount} attending
      </div>
    </IslandCard>
  );
}

function Pill({ tone, children }: { tone: "success" | "muted" | "danger"; children: ReactNode }) {
  const palette =
    tone === "success"
      ? { bg: "rgba(74, 222, 128, 0.18)", fg: "#4ade80" }
      : tone === "danger"
        ? { bg: "rgba(239, 68, 68, 0.18)", fg: "#fca5a5" }
        : { bg: islandTheme.color.panelMutedBg, fg: islandTheme.color.textMuted };
  return (
    <span
      className="island-mono"
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "2px 8px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg
      }}
    >
      {children}
    </span>
  );
}

function formatNightDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBD";
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

const WISHLIST_MOCK = [
  { game: "Hollow Knight: Silksong", crew: 6, art: "🐛" },
  { game: "Star Citizen 4.0", crew: 4, art: "🚀" },
  { game: "Borderlands 4", crew: 5, art: "🔫" },
  { game: "Pioneers of Pagonia", crew: 3, art: "🏰" },
  { game: "Tiny Glade", crew: 7, art: "🌿" }
];

function GroupWishlist() {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <SectionHead
        title="Group wishlist"
        meta="Pooled Steam wishlists, sorted by crew hype. Most wanted at the top."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10
        }}
      >
        {WISHLIST_MOCK.map((w) => (
          <article
            key={w.game}
            style={{
              padding: 12,
              borderRadius: 12,
              background: islandTheme.color.panelBg,
              backdropFilter: islandTheme.glass.blur,
              WebkitBackdropFilter: islandTheme.glass.blur,
              border: `1px solid ${islandTheme.color.cardBorder}`,
              display: "grid",
              gridTemplateColumns: "44px 1fr",
              gap: 10,
              alignItems: "center"
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: islandTheme.color.panelMutedBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22
              }}
            >
              {w.art}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{w.game}</div>
              <HypeBar count={w.crew} max={8} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HypeBar({ count, max }: { count: number; max: number }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: islandTheme.color.panelMutedBg,
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${islandTheme.color.primaryGlow}, ${islandTheme.palette.sandWarmAccent})`
          }}
        />
      </div>
      <div className="island-mono" style={{ fontSize: 10, color: islandTheme.color.textMuted, marginTop: 3 }}>
        {count} / {max} crew
      </div>
    </div>
  );
}

function LibrarySnapshot({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <IslandCard
      style={{
        padding: 16,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 14,
        alignItems: "center"
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "linear-gradient(135deg, #fbbf24, #ef8354)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26
        }}
      >
        🗂
      </div>
      <div>
        <div className="island-display" style={{ fontSize: 17, fontWeight: 800 }}>
          Steam library
        </div>
        <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, marginTop: 3 }}>
          Filterable list of all crew-owned games with co-ownership badges. Quick PLAN shortcut on every row.
        </div>
      </div>
      <button
        type="button"
        onClick={() => onNavigate("library")}
        style={{
          background: islandTheme.color.primary,
          border: `1px solid ${islandTheme.color.primary}`,
          color: islandTheme.color.primaryText,
          padding: "7px 14px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          font: "inherit"
        }}
      >
        Browse library →
      </button>
    </IslandCard>
  );
}

const STREAMS_MOCK = [
  { name: "jkraken", game: "Helldivers II", viewers: 142, status: "live" },
  { name: "aloha-pirate", game: "Stardew Valley", viewers: 38, status: "live" },
  { name: "palmwave", game: "Cosmic Cruiser", viewers: 12, status: "live" }
];

function StreamDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 0,
          top: "44%",
          transform: "translateY(-50%) rotate(180deg)",
          writingMode: "vertical-rl",
          padding: "16px 8px",
          background: "rgba(220, 38, 38, 0.85)",
          color: "#fff",
          border: "none",
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: "pointer",
          zIndex: 60,
          font: "inherit",
          boxShadow: "-4px 0 14px rgba(0,0,0,0.4)"
        }}
      >
        ● Live · {STREAMS_MOCK.length}
      </button>
      <aside
        style={{
          position: "fixed",
          right: 0,
          top: 70,
          bottom: 0,
          width: 320,
          maxWidth: "90vw",
          background: islandTheme.color.panelBg,
          backdropFilter: islandTheme.glass.blurStrong,
          WebkitBackdropFilter: islandTheme.glass.blurStrong,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          borderRight: "none",
          borderTopLeftRadius: 14,
          borderBottomLeftRadius: 14,
          padding: "14px 12px",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          zIndex: 55,
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <h3 className="island-display" style={{ margin: 0, fontSize: 15 }}>
            Live streams
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: islandTheme.color.textMuted,
              cursor: "pointer",
              fontSize: 16
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {STREAMS_MOCK.map((s) => (
            <article
              key={s.name}
              style={{
                padding: 10,
                borderRadius: 10,
                background: islandTheme.color.panelMutedBg,
                border: `1px solid ${islandTheme.color.cardBorder}`,
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 10
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "rgba(220, 38, 38, 0.85)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                ●
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: islandTheme.color.textSubtle }}>{s.game}</div>
                <div className="island-mono" style={{ fontSize: 10, color: islandTheme.color.textMuted, marginTop: 2 }}>
                  {s.viewers} watching
                </div>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </>
  );
}

function SectionHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div>
      <h2 className="island-display" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
        {title}
      </h2>
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
        {meta}
      </div>
    </div>
  );
}
