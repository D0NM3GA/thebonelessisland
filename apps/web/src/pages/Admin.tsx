import { useState, type CSSProperties, type ReactNode } from "react";
import { IslandButton, IslandCard, islandInputStyle } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type { Recommendation } from "../types.js";

type AdminSection =
  | "hub"
  | "news"
  | "recommendations"
  | "data-sync"
  | "members"
  | "game-nights"
  | "forums"
  | "tournaments"
  | "library"
  | "audit";

type AdminPageProps = {
  selectedMemberCount: number;
  recommendations: Recommendation[];
  onRunRecommendation: () => void;
  newsKeywords: string;
  onNewsKeywordsChange: (value: string) => void;
  newsSources: string;
  onNewsSourcesChange: (value: string) => void;
  onSaveNewsControls: () => void;
  profileJson: string;
};

export function AdminPage(props: AdminPageProps) {
  const [section, setSection] = useState<AdminSection>("hub");

  if (section === "hub") {
    return <AdminHub onSelect={setSection} />;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SubpageHeader section={section} onBack={() => setSection("hub")} />
      {section === "news" ? <NewsCurationSubpage {...props} /> : null}
      {section === "recommendations" ? <RecommendationsSubpage {...props} /> : null}
      {section === "data-sync" ? <DataSyncSubpage /> : null}
      {section === "members" ? <MembersSubpage /> : null}
      {section === "game-nights" ? <GameNightsModSubpage /> : null}
      {section === "forums" ? <ForumsModSubpage /> : null}
      {section === "tournaments" ? <TournamentsSubpage /> : null}
      {section === "library" ? <LibrarySubpage /> : null}
      {section === "audit" ? <AuditSubpage profileJson={props.profileJson} /> : null}
    </div>
  );
}

type AdminTile = {
  id: AdminSection;
  title: string;
  blurb: string;
  icon: string;
  accent: string;
};

const ADMIN_TILES: AdminTile[] = [
  { id: "news", title: "News Curation", blurb: "Filters, auto-approve rules, approval queue.", icon: "📰", accent: "#0ea5e9" },
  { id: "recommendations", title: "Recommendation Tester", blurb: "Member chips, weights, ranked results.", icon: "🎯", accent: "#22d3ee" },
  { id: "data-sync", title: "Data Sync", blurb: "Connector health + live log.", icon: "🔄", accent: "#86efac" },
  { id: "members", title: "Members & Roles", blurb: "Roster, role mapping, onboarding queue.", icon: "👥", accent: "#a78bfa" },
  { id: "game-nights", title: "Game Night Moderation", blurb: "Lock/reopen sessions, force picks, defaults.", icon: "🎮", accent: "#f59e0b" },
  { id: "forums", title: "Forum Moderation", blurb: "Reports, channel access, word filter.", icon: "💬", accent: "#ef8354" },
  { id: "tournaments", title: "Tournaments", blurb: "Schedule + bracket preview.", icon: "🏆", accent: "#fbbf24" },
  { id: "library", title: "Game Library", blurb: "Featured pick, tag/visibility overrides.", icon: "🗂", accent: "#fb7185" },
  { id: "audit", title: "Audit Log", blurb: "Searchable trail with CSV export.", icon: "📜", accent: "#94a3b8" }
];

function AdminHub({ onSelect }: { onSelect: (s: AdminSection) => void }) {
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
          ★ Admin · Parent
        </span>
        <h1 className="island-display" style={{ margin: 0, fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800 }}>
          Admin
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: islandTheme.color.textSubtle,
            maxWidth: 640
          }}
        >
          Operational + moderation controls for the island. Role-gated to the <strong>Parent</strong> Discord role.
        </p>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14
        }}
      >
        {ADMIN_TILES.map((t) => (
          <HubTile key={t.id} tile={t} onClick={() => onSelect(t.id)} />
        ))}
      </div>
    </div>
  );
}

function HubTile({ tile, onClick }: { tile: AdminTile; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 16,
        borderRadius: 14,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        background: `linear-gradient(135deg, ${tile.accent}22 0%, ${islandTheme.color.panelBg} 80%)`,
        backdropFilter: islandTheme.glass.blur,
        WebkitBackdropFilter: islandTheme.glass.blur,
        color: islandTheme.color.textPrimary,
        cursor: "pointer",
        font: "inherit",
        transition: "transform 140ms ease, border-color 140ms ease"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = tile.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = islandTheme.color.cardBorder;
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${tile.accent}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          marginBottom: 10
        }}
      >
        {tile.icon}
      </div>
      <div className="island-display" style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        {tile.title}
      </div>
      <div style={{ fontSize: 12, color: islandTheme.color.textSubtle, lineHeight: 1.45 }}>
        {tile.blurb}
      </div>
      <div
        className="island-mono"
        style={{
          marginTop: 10,
          fontSize: 11,
          color: tile.accent,
          textTransform: "uppercase",
          letterSpacing: "0.08em"
        }}
      >
        Open →
      </div>
    </button>
  );
}

function SubpageHeader({ section, onBack }: { section: AdminSection; onBack: () => void }) {
  const tile = ADMIN_TILES.find((t) => t.id === section);
  if (!tile) return null;
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
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
        ← Admin hub
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${tile.accent}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20
          }}
        >
          {tile.icon}
        </div>
        <h1 className="island-display" style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800 }}>
          {tile.title}
        </h1>
      </div>
      <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {tile.blurb}
      </div>
    </header>
  );
}

function NewsCurationSubpage({
  newsKeywords,
  onNewsKeywordsChange,
  newsSources,
  onNewsSourcesChange,
  onSaveNewsControls
}: AdminPageProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Filters</SubsectionTitle>
        <Field label="Keywords / genres / titles">
          <input
            value={newsKeywords}
            onChange={(e) => onNewsKeywordsChange(e.target.value)}
            style={{ ...islandInputStyle, width: "100%" }}
          />
        </Field>
        <Field label="Approved sources">
          <input
            value={newsSources}
            onChange={(e) => onNewsSourcesChange(e.target.value)}
            style={{ ...islandInputStyle, width: "100%" }}
          />
        </Field>
        <IslandButton variant="primary" onClick={onSaveNewsControls} style={{ marginTop: 8 }}>
          Save filters
        </IslandButton>
      </IslandCard>

      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Auto-approve rules</SubsectionTitle>
        <RuleRow label="Steam News for crew-owned games" enabled />
        <RuleRow label="PC Gamer · curated co-op tag" enabled />
        <RuleRow label="IGN · all" enabled={false} />
        <RuleRow label="Reddit · r/PatchNotes" enabled />
      </IslandCard>

      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <SubsectionTitle style={{ padding: "14px 16px 0" }}>Approval queue · 4 items</SubsectionTitle>
        {[
          { title: "Stardew 1.6.9 — performance fixes", source: "Steam News", ago: "12m" },
          { title: "Risk of Rain Returns DLC roadmap", source: "Reddit", ago: "2h" },
          { title: "Helldivers Major Order recap", source: "PC Gamer", ago: "5h" },
          { title: "Lethal V60 reaction roundup", source: "IGN", ago: "1d" }
        ].map((item, i) => (
          <ApprovalRow key={item.title} entry={item} firstRow={i === 0} />
        ))}
      </IslandCard>
    </div>
  );
}

function RuleRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderTop: `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <span style={{ fontSize: 13 }}>{label}</span>
      <Toggle on={enabled} />
    </div>
  );
}

function ApprovalRow({
  entry,
  firstRow
}: {
  entry: { title: string; source: string; ago: string };
  firstRow: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        padding: "12px 16px",
        alignItems: "center",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.title}</div>
        <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, marginTop: 2 }}>
          {entry.source} · {entry.ago} ago
        </div>
      </div>
      <button type="button" style={smallBtn(islandTheme.color.primary, "#fff")}>
        Approve
      </button>
      <button type="button" style={smallBtn("transparent", islandTheme.color.textMuted, true)}>
        Skip
      </button>
    </div>
  );
}

function RecommendationsSubpage({
  selectedMemberCount,
  recommendations,
  onRunRecommendation
}: AdminPageProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16, display: "grid", gap: 10 }}>
        <SubsectionTitle>Inputs</SubsectionTitle>
        <div style={{ fontSize: 13, color: islandTheme.color.textSubtle }}>
          Selected members from Game Nights crew picker:{" "}
          <strong style={{ color: islandTheme.color.textPrimary }}>{selectedMemberCount}</strong>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Slider label="Library overlap weight" value={1.0} />
          <Slider label="Online crew weight" value={0.8} />
          <Slider label="Novelty weight" value={0.4} />
          <Slider label="Party-friendly weight" value={0.6} />
        </div>
        <IslandButton variant="primary" onClick={onRunRecommendation} style={{ marginTop: 4 }}>
          Run "What can we play"
        </IslandButton>
      </IslandCard>

      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <SubsectionTitle style={{ padding: "14px 16px 0" }}>
          Ranked results · {recommendations.length}
        </SubsectionTitle>
        {recommendations.length ? (
          recommendations.map((r, i) => <RecRow key={r.appId} rec={r} firstRow={i === 0} />)
        ) : (
          <p style={{ padding: "10px 16px 16px", margin: 0, fontSize: 13, color: islandTheme.color.textMuted }}>
            No tester results yet. Pick crew + run.
          </p>
        )}
      </IslandCard>
    </div>
  );
}

function RecRow({ rec, firstRow }: { rec: Recommendation; firstRow: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        padding: "12px 16px",
        alignItems: "center",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{rec.name}</div>
        <div style={{ fontSize: 12, color: islandTheme.color.textMuted, marginTop: 2 }}>{rec.reason}</div>
      </div>
      <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {rec.owners} own · miss {rec.nearMatchMissingMembers}
      </span>
      <span
        className="island-mono"
        style={{ fontSize: 13, fontWeight: 700, color: islandTheme.palette.sandWarmAccent }}
      >
        {rec.score.toFixed(2)}
      </span>
    </div>
  );
}

function DataSyncSubpage() {
  const connectors = [
    { name: "Discord OAuth", status: "ok", last: "live" },
    { name: "Discord Members", status: "ok", last: "60s" },
    { name: "Discord Voice State", status: "ok", last: "15s" },
    { name: "Steam OpenID", status: "ok", last: "live" },
    { name: "Steam OwnedGames", status: "warn", last: "26m · throttled" },
    { name: "Steam Wishlist", status: "off", last: "not wired" }
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <SubsectionTitle style={{ padding: "14px 16px 0" }}>Connectors</SubsectionTitle>
        {connectors.map((c, i) => (
          <ConnectorRow key={c.name} entry={c} firstRow={i === 0} />
        ))}
      </IslandCard>

      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Live log</SubsectionTitle>
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: islandTheme.color.panelMutedBg,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            borderRadius: 8,
            fontFamily: islandTheme.font.mono,
            fontSize: 11,
            color: islandTheme.color.textSubtle,
            maxHeight: 240,
            overflow: "auto"
          }}
        >
{`[ok]   discord.member.sync     guild=1172780198912065536  count=24      4.2s
[ok]   discord.voice.snapshot  in_voice=4                              0.6s
[ok]   steam.owned.refresh     user=donmega   games=141    180KB       2.1s
[warn] steam.owned.refresh     user=palmwave  HTTP 429 retry-after=60
[ok]   game_nights.scan        scheduled=3   upcoming=2                0.2s`}
        </pre>
      </IslandCard>
    </div>
  );
}

function ConnectorRow({
  entry,
  firstRow
}: {
  entry: { name: string; status: string; last: string };
  firstRow: boolean;
}) {
  const tone =
    entry.status === "ok"
      ? { dot: "#4ade80", label: "OK" }
      : entry.status === "warn"
        ? { dot: "#facc15", label: "WARN" }
        : { dot: "#94a3b8", label: "OFF" };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        padding: "12px 16px",
        alignItems: "center",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.name}</div>
      <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {entry.last}
      </span>
      <span
        className="island-mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: tone.dot,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot }} />
        {tone.label}
      </span>
    </div>
  );
}

function MembersSubpage() {
  const roster = [
    { handle: "donmega", roles: ["Parent", "Crew"], joined: "2019-04-12", status: "online" },
    { handle: "jkraken", roles: ["Crew", "Captain"], joined: "2020-01-08", status: "online" },
    { handle: "aloha-pirate", roles: ["Crew", "Late-Boat"], joined: "2020-06-22", status: "live" },
    { handle: "palmwave", roles: ["Crew", "Cozy"], joined: "2021-03-17", status: "online" },
    { handle: "ChefNugget", roles: ["Crew"], joined: "2022-11-05", status: "online" },
    { handle: "LoreNugget", roles: ["Crew", "Lore"], joined: "2023-02-19", status: "idle" },
    { handle: "ReefTroll", roles: ["Crew"], joined: "2023-08-30", status: "idle" },
    { handle: "newGuest", roles: ["Onboarding"], joined: "2026-04-29", status: "online" }
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <SubsectionTitle style={{ padding: "14px 16px 0" }}>Roster</SubsectionTitle>
        <div
          className="island-mono"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr 100px 80px auto",
            gap: 12,
            padding: "8px 16px",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: islandTheme.color.textMuted,
            borderTop: `1px solid ${islandTheme.color.cardBorder}`,
            borderBottom: `1px solid ${islandTheme.color.cardBorder}`
          }}
        >
          <div>Handle</div>
          <div>Roles</div>
          <div>Joined</div>
          <div>Status</div>
          <div />
        </div>
        {roster.map((r, i) => (
          <MemberRow key={r.handle} entry={r} firstRow={i === 0} />
        ))}
      </IslandCard>

      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Role mapping</SubsectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          Discord roles → app capabilities. <strong>Parent</strong> = full admin. <strong>Captain</strong> = host
          privileges. <strong>Onboarding</strong> = read-only until promoted.
        </p>
      </IslandCard>

      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Onboarding queue · 1</SubsectionTitle>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0"
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>newGuest</div>
            <div style={{ fontSize: 12, color: islandTheme.color.textMuted }}>Joined 2 days ago</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" style={smallBtn(islandTheme.color.primary, "#fff")}>
              Promote
            </button>
            <button type="button" style={smallBtn("transparent", "#fca5a5", true, "#7f1d1d")}>
              Remove
            </button>
          </div>
        </div>
      </IslandCard>
    </div>
  );
}

function MemberRow({
  entry,
  firstRow
}: {
  entry: { handle: string; roles: string[]; joined: string; status: string };
  firstRow: boolean;
}) {
  const dot = entry.status === "online" ? "#4ade80" : entry.status === "live" ? "#ef4444" : "#94a3b8";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.4fr 100px 80px auto",
        gap: 12,
        padding: "12px 16px",
        alignItems: "center",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.handle}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {entry.roles.map((r) => (
          <span
            key={r}
            className="island-mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background: islandTheme.color.panelMutedBg,
              border: `1px solid ${islandTheme.color.cardBorder}`,
              color: islandTheme.color.textSubtle
            }}
          >
            {r}
          </span>
        ))}
      </div>
      <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
        {entry.joined}
      </span>
      <span
        className="island-mono"
        style={{ fontSize: 10, color: dot, display: "flex", alignItems: "center", gap: 4 }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
        {entry.status}
      </span>
      <button type="button" style={smallBtn("transparent", islandTheme.color.textMuted, true)}>
        Edit
      </button>
    </div>
  );
}

function GameNightsModSubpage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Defaults</SubsectionTitle>
        <Field label="Default voice channel">
          <input defaultValue="Lagoon Lounge" style={{ ...islandInputStyle, width: "100%" }} />
        </Field>
        <Field label="Auto-pick window before start">
          <input defaultValue="60 minutes" style={{ ...islandInputStyle, width: "100%" }} />
        </Field>
        <RuleRow label="Allow non-Parent hosts" enabled />
        <RuleRow label="Require crew RSVP before game lock" enabled />
        <RuleRow label="Auto-DM no-shows after night ends" enabled={false} />
      </IslandCard>

      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Active sessions</SubsectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textSubtle }}>
          No sessions live. Inflight nights show here with lock/reopen + force-pick controls.
        </p>
      </IslandCard>
    </div>
  );
}

function ForumsModSubpage() {
  const reports = [
    { who: "@anonymous", target: "#late-boat thread #4823", reason: "Spam", ago: "1h" },
    { who: "@LoreNugget", target: "#stories thread #4801", reason: "Off-topic", ago: "5h" }
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <SubsectionTitle style={{ padding: "14px 16px 0" }}>Reports · {reports.length}</SubsectionTitle>
        {reports.map((r, i) => (
          <div
            key={r.target}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: 12,
              padding: "12px 16px",
              alignItems: "center",
              borderTop: i === 0 ? "none" : `1px solid ${islandTheme.color.cardBorder}`
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{r.target}</div>
              <div style={{ fontSize: 12, color: islandTheme.color.textMuted, marginTop: 2 }}>
                Reported by {r.who} · {r.reason} · {r.ago} ago
              </div>
            </div>
            <button type="button" style={smallBtn(islandTheme.color.primary, "#fff")}>
              Resolve
            </button>
            <button type="button" style={smallBtn("transparent", "#fca5a5", true, "#7f1d1d")}>
              Remove
            </button>
          </div>
        ))}
      </IslandCard>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Word filter</SubsectionTitle>
        <Field label="Banned terms (comma-separated)">
          <input defaultValue="" placeholder="None" style={{ ...islandInputStyle, width: "100%" }} />
        </Field>
        <RuleRow label="Auto-flag mentions of new patches early" enabled />
        <RuleRow label="Cooldown for new accounts (24h)" enabled />
      </IslandCard>
    </div>
  );
}

function TournamentsSubpage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Schedule</SubsectionTitle>
        {[
          { date: "May 03", title: "Beach BBQ Tournament", game: "Deep Sea Dunkers", entries: 14 },
          { date: "May 10", title: "Speedrun Sunday", game: "Cosmic Cruiser", entries: 8 },
          { date: "May 24", title: "Cozy Co-op Cup", game: "Stardew Valley", entries: 6 }
        ].map((e) => (
          <div
            key={e.title}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr auto",
              gap: 12,
              padding: "10px 0",
              borderTop: `1px solid ${islandTheme.color.cardBorder}`,
              alignItems: "center"
            }}
          >
            <span className="island-mono" style={{ fontSize: 11, color: islandTheme.palette.sandWarmAccent }}>
              {e.date}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{e.title}</div>
              <div style={{ fontSize: 12, color: islandTheme.color.textMuted, marginTop: 2 }}>
                {e.game} · {e.entries} entries
              </div>
            </div>
            <button type="button" style={smallBtn("transparent", islandTheme.color.textMuted, true)}>
              Bracket
            </button>
          </div>
        ))}
      </IslandCard>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Bracket preview</SubsectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textSubtle }}>
          Single-elim bracket renders here once a tournament locks at start time.
        </p>
      </IslandCard>
    </div>
  );
}

function LibrarySubpage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Featured pick</SubsectionTitle>
        <Field label="Game of the Month">
          <input defaultValue="Deep Sea Dunkers: The Kraken's Hoard" style={{ ...islandInputStyle, width: "100%" }} />
        </Field>
        <Field label="Override blurb">
          <input
            defaultValue="Co-op submarine looting in haunted reefs."
            style={{ ...islandInputStyle, width: "100%" }}
          />
        </Field>
        <IslandButton variant="primary">Save</IslandButton>
      </IslandCard>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>Tag overrides</SubsectionTitle>
        {[
          { game: "Lethal Company", tags: "horror, co-op" },
          { game: "Helldivers II", tags: "co-op, shooter" },
          { game: "Stardew Valley", tags: "cozy, co-op" }
        ].map((row, i) => (
          <div
            key={row.game}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 12,
              padding: "10px 0",
              borderTop: i === 0 ? "none" : `1px solid ${islandTheme.color.cardBorder}`,
              alignItems: "center"
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>{row.game}</div>
            <span
              className="island-mono"
              style={{ fontSize: 11, color: islandTheme.color.textSubtle }}
            >
              {row.tags}
            </span>
            <button type="button" style={smallBtn("transparent", islandTheme.color.textMuted, true)}>
              Edit
            </button>
          </div>
        ))}
      </IslandCard>
    </div>
  );
}

function AuditSubpage({ profileJson }: { profileJson: string }) {
  const events = [
    { who: "donmega", what: "promoted", target: "newGuest → Crew", ago: "2h" },
    { who: "donmega", what: "approved", target: "news item #392", ago: "5h" },
    { who: "donmega", what: "force-picked", target: "Friday Night → Helldivers II", ago: "yesterday" },
    { who: "system", what: "auto-flagged", target: "thread #4823 (#late-boat)", ago: "1d" }
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search audit log…" style={{ ...islandInputStyle, flex: 1, minWidth: 240 }} />
        <button type="button" style={smallBtn("transparent", islandTheme.color.textSubtle, true)}>
          Export CSV
        </button>
      </IslandCard>
      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        {events.map((e, i) => (
          <div
            key={e.target + i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              padding: "12px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${islandTheme.color.cardBorder}`,
              alignItems: "center"
            }}
          >
            <div>
              <div style={{ fontSize: 13 }}>
                <strong>{e.who}</strong> {e.what} <strong>{e.target}</strong>
              </div>
            </div>
            <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>
              {e.ago} ago
            </span>
          </div>
        ))}
      </IslandCard>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13, color: islandTheme.color.textMuted }}>
          Profile payload (debug)
        </summary>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: islandTheme.color.panelMutedBg,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            borderRadius: 8,
            fontFamily: islandTheme.font.mono,
            fontSize: 11,
            color: islandTheme.color.textSubtle,
            maxHeight: 320,
            overflow: "auto"
          }}
        >
          {profileJson}
        </pre>
      </details>
    </div>
  );
}

function SubsectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h3
      className="island-display"
      style={{
        margin: 0,
        marginBottom: 10,
        fontSize: 14,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: islandTheme.color.textMuted,
        ...style
      }}
    >
      {children}
    </h3>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
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
      {children}
    </label>
  );
}

function Slider({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: islandTheme.color.textSubtle }}>{label}</span>
        <span className="island-mono" style={{ color: islandTheme.color.textMuted }}>
          {value.toFixed(1)}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 6,
          borderRadius: 999,
          background: islandTheme.color.panelMutedBg,
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${islandTheme.color.primaryGlow}, ${islandTheme.palette.sandWarmAccent})`
          }}
        />
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 36,
        height: 20,
        borderRadius: 999,
        background: on ? "rgba(74, 222, 128, 0.4)" : islandTheme.color.panelMutedBg,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        position: "relative",
        transition: "background 200ms"
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: on ? "#4ade80" : "#94a3b8",
          transition: "left 200ms"
        }}
      />
    </span>
  );
}

function smallBtn(bg: string, fg: string, ghost = false, border?: string): CSSProperties {
  return {
    background: bg,
    border: `1px solid ${ghost ? border ?? islandTheme.color.cardBorder : bg}`,
    color: fg,
    fontSize: 11,
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: 999,
    cursor: "pointer",
    font: "inherit"
  };
}
