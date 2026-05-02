import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { IslandButton, IslandCard, islandInputStyle } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type { NewsCard, Recommendation, ServerSetting } from "../types.js";

type AdminSection =
  | "hub"
  | "server-config"
  | "news"
  | "recommendations"
  | "data-sync"
  | "members"
  | "game-nights"
  | "forums"
  | "tournaments"
  | "library"
  | "audit"
  | "ai-settings";

type NewsCardInput = {
  title: string;
  body: string;
  icon?: string;
  tag?: string | null;
  sourceUrl?: string | null;
};

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
  newsCards: NewsCard[];
  onCreateNewsCard: (input: NewsCardInput) => void;
  onUpdateNewsCard: (id: string, input: Partial<NewsCardInput>) => void;
  onArchiveNewsCard: (id: string) => void;
  serverSettings: ServerSetting[] | null;
  onLoadServerSettings: () => void;
  onUpdateServerSetting: (key: string, value: string) => void;
  onTestAIConnection: (opts: { provider: string; model?: string; apiKey?: string }) => Promise<{ ok: boolean; provider?: string; model?: string; error?: string }>;
  onTriggerNewsCuration: () => Promise<{ ok: boolean; curated?: number; error?: string }>;
};

export function AdminPage(props: AdminPageProps) {
  const [section, setSection] = useState<AdminSection>("hub");

  const handleSelectSection = (s: AdminSection) => {
    setSection(s);
    if ((s === "server-config" || s === "ai-settings") && props.serverSettings === null) {
      props.onLoadServerSettings();
    }
  };

  if (section === "hub") {
    return <AdminHub onSelect={handleSelectSection} />;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SubpageHeader section={section} onBack={() => setSection("hub")} />
      {section === "server-config" ? (
        <ServerConfigSubpage
          settings={props.serverSettings}
          onUpdate={props.onUpdateServerSetting}
        />
      ) : null}
      {section === "ai-settings" ? (
        <AISettingsSubpage
          settings={props.serverSettings}
          onUpdate={props.onUpdateServerSetting}
          onTest={props.onTestAIConnection}
        />
      ) : null}
      {section === "news" ? <NewsCurationSubpage {...props} /> : null}
      {section === "recommendations" ? <RecommendationsSubpage {...props} /> : null}
      {section === "data-sync" ? <DataSyncSubpage onTriggerCuration={props.onTriggerNewsCuration} /> : null}
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
  { id: "server-config", title: "Server Configuration", blurb: "Guild ID, admin role, display name. Switch servers without touching .env.", icon: "⚙️", accent: "#6366f1" },
  { id: "ai-settings", title: "AI Settings", blurb: "Provider, model, API key, enable/disable. Swap between Anthropic and OpenAI without touching code.", icon: "🤖", accent: "#8b5cf6" },
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
  newsCards,
  onCreateNewsCard,
  onUpdateNewsCard,
  onArchiveNewsCard
}: AdminPageProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <IslandCard style={{ padding: 16 }}>
        <SubsectionTitle>New drift log card</SubsectionTitle>
        <p style={{ margin: "4px 0 12px", fontSize: 12, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          Posts here show up on the Home page Drift Log for the whole crew. Keep it short, in-island, and link the source if it's a patch note or article.
        </p>
        <NewsCardEditor
          mode="create"
          onSubmit={(input) => onCreateNewsCard(input)}
        />
      </IslandCard>

      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <SubsectionTitle style={{ padding: "14px 16px 0" }}>
          Published cards · {newsCards.length}
        </SubsectionTitle>
        {newsCards.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "10px 16px 16px",
              fontSize: 13,
              color: islandTheme.color.textMuted
            }}
          >
            No drift log cards yet. Post the first one above.
          </p>
        ) : (
          newsCards.map((card, i) => (
            <NewsCardRow
              key={card.id}
              card={card}
              firstRow={i === 0}
              onUpdate={(input) => onUpdateNewsCard(card.id, input)}
              onArchive={() => onArchiveNewsCard(card.id)}
            />
          ))
        )}
      </IslandCard>
    </div>
  );
}

function NewsCardEditor({
  mode,
  initial,
  onSubmit,
  onCancel
}: {
  mode: "create" | "edit";
  initial?: { title: string; body: string; icon: string; tag: string | null; sourceUrl: string | null };
  onSubmit: (input: NewsCardInput) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🌊");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");

  const submit = () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;
    onSubmit({
      title: trimmedTitle,
      body: trimmedBody,
      icon: icon.trim() || "🌊",
      tag: tag.trim() ? tag.trim() : null,
      sourceUrl: sourceUrl.trim() ? sourceUrl.trim() : null
    });
    if (mode === "create") {
      setTitle("");
      setBody("");
      setIcon("🌊");
      setTag("");
      setSourceUrl("");
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8 }}>
        <Field label="Icon">
          <input
            value={icon}
            maxLength={4}
            onChange={(e) => setIcon(e.target.value)}
            style={{ ...islandInputStyle, width: "100%", textAlign: "center", fontSize: 18 }}
          />
        </Field>
        <Field label="Headline">
          <input
            value={title}
            placeholder="Tide check: Stardew 1.6.9 lands"
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...islandInputStyle, width: "100%" }}
          />
        </Field>
      </div>
      <Field label="Body">
        <textarea
          value={body}
          rows={3}
          placeholder="One short paragraph. Keep it island-flavored — what does the crew need to know?"
          onChange={(e) => setBody(e.target.value)}
          style={{ ...islandInputStyle, width: "100%", resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label="Tag (optional)">
          <input
            value={tag}
            placeholder="patch · sale · cozy"
            onChange={(e) => setTag(e.target.value)}
            style={{ ...islandInputStyle, width: "100%" }}
          />
        </Field>
        <Field label="Source URL (optional)">
          <input
            value={sourceUrl}
            placeholder="https://"
            onChange={(e) => setSourceUrl(e.target.value)}
            style={{ ...islandInputStyle, width: "100%" }}
          />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <IslandButton variant="primary" onClick={submit}>
          {mode === "create" ? "Post to drift log" : "Save changes"}
        </IslandButton>
        {onCancel ? (
          <IslandButton variant="secondary" onClick={onCancel}>
            Cancel
          </IslandButton>
        ) : null}
      </div>
    </div>
  );
}

function NewsCardRow({
  card,
  firstRow,
  onUpdate,
  onArchive
}: {
  card: NewsCard;
  firstRow: boolean;
  onUpdate: (input: NewsCardInput) => void;
  onArchive: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`,
        display: "grid",
        gap: 8
      }}
    >
      {editing ? (
        <NewsCardEditor
          mode="edit"
          initial={{
            title: card.title,
            body: card.body,
            icon: card.icon,
            tag: card.tag,
            sourceUrl: card.sourceUrl
          }}
          onSubmit={(input) => {
            onUpdate(input);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 12, alignItems: "start" }}>
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
              {card.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: islandTheme.color.textSubtle, marginTop: 4, lineHeight: 1.5 }}>
                {card.body}
              </div>
              <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, marginTop: 6 }}>
                {card.tag ?? "drift log"} · posted {new Date(card.publishedAt).toLocaleDateString()}
                {card.createdBy ? ` · by ${card.createdBy.displayName}` : ""}
                {card.sourceUrl ? " · linked" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={smallBtn(islandTheme.color.primary, "#fff")} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                style={smallBtn("transparent", islandTheme.color.dangerText, true, islandTheme.color.danger)}
                onClick={onArchive}
              >
                Archive
              </button>
            </div>
          </div>
        </>
      )}
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

function DataSyncSubpage({ onTriggerCuration }: { onTriggerCuration: () => Promise<{ ok: boolean; curated?: number; error?: string }> }) {
  const [curationState, setCurationState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [curationMsg, setCurationMsg] = useState("");

  const handleCurate = async () => {
    setCurationState("running");
    setCurationMsg("");
    const result = await onTriggerCuration();
    if (result.ok) {
      setCurationState("done");
      setCurationMsg(`Curated ${result.curated ?? 0} article${result.curated === 1 ? "" : "s"}`);
    } else {
      setCurationState("error");
      setCurationMsg(result.error ?? "Curation failed");
    }
    setTimeout(() => setCurationState("idle"), 5000);
  };

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

      <IslandCard style={{ padding: 16, display: "grid", gap: 12 }}>
        <SubsectionTitle>AI News Curation</SubsectionTitle>
        <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          Re-score and summarize un-curated game news items using the active AI provider.
          Runs automatically on the next news fetch — use this to force an immediate pass.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IslandButton
            variant="secondary"
            onClick={handleCurate}
            disabled={curationState === "running"}
          >
            {curationState === "running" ? "Curating…" : "Re-curate News"}
          </IslandButton>
          {curationMsg ? (
            <span
              style={{
                fontSize: 12,
                color: curationState === "error" ? islandTheme.color.danger : islandTheme.color.success
              }}
            >
              {curationMsg}
            </span>
          ) : null}
        </div>
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

// ── Server Configuration ──────────────────────────────────────────────────────

const SERVER_CONFIG_META: Record<string, { hint: string; sensitive?: boolean; restart?: boolean }> = {
  discord_guild_id: {
    hint: 'Right-click your server in Discord › "Copy Server ID" (Developer Mode must be on).',
    restart: false
  },
  guild_display_name: {
    hint: "Shown in the admin panel header only. No effect on API behaviour."
  },
  parent_role_name: {
    hint: 'The exact role name from your Discord server that grants admin access here.',
    restart: false
  }
};

function ServerConfigSubpage({
  settings,
  onUpdate
}: {
  settings: ServerSetting[] | null;
  onUpdate: (key: string, value: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]))
  );
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  if (settings === null) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <IslandCard key={i} style={{ padding: "16px 18px" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  height: 14,
                  width: `${55 + i * 15}%`,
                  borderRadius: 6,
                  background: islandTheme.color.panelMutedBg,
                  animation: "settingsSkelPulse 1.4s ease-in-out infinite"
                }}
              />
              <div
                style={{
                  height: 36,
                  borderRadius: 8,
                  background: islandTheme.color.panelMutedBg,
                  animation: "settingsSkelPulse 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`
                }}
              />
            </div>
          </IslandCard>
        ))}
        <style>{`
          @keyframes settingsSkelPulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 0.9; }
          }
        `}</style>
      </div>
    );
  }

  if (settings.length === 0) {
    return (
      <IslandCard style={{ padding: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textMuted }}>
          No configurable settings found. Run <code>npm run db:migrate</code> to apply migration 012.
        </p>
      </IslandCard>
    );
  }

  const handleSave = (key: string) => {
    onUpdate(key, drafts[key] ?? "");
    setSaved((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2200);
  };

  const currentGuildId = settings.find((s) => s.key === "discord_guild_id");
  const displayName = settings.find((s) => s.key === "guild_display_name");
  const serverLabel = displayName?.value || currentGuildId?.value || "Not configured";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Active server banner */}
      <IslandCard
        style={{
          padding: "14px 18px",
          background: `linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, ${islandTheme.color.panelBg} 100%)`,
          border: `1px solid rgba(99, 102, 241, 0.35)`
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>⚙️</span>
          <div>
            <div className="island-mono" style={{ fontSize: 10, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Currently pointed at
            </div>
            <div className="island-display" style={{ fontWeight: 800, fontSize: 18 }}>
              {serverLabel}
            </div>
            {currentGuildId?.envDefault && !currentGuildId?.value ? (
              <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, marginTop: 2 }}>
                Using env fallback: {currentGuildId.envDefault}
              </div>
            ) : null}
          </div>
        </div>
      </IslandCard>

      {/* Warning */}
      <IslandCard
        style={{
          padding: "12px 16px",
          background: "rgba(245, 158, 11, 0.1)",
          border: "1px solid rgba(245, 158, 11, 0.35)"
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span>⚠️</span>
          <p style={{ margin: 0, fontSize: 13, color: "#fcd34d", lineHeight: 1.5 }}>
            Changing the <strong>Guild ID</strong> takes effect immediately on the next request —
            all member sync, role checks, and crew data will point to the new server.
            Run a member sync after switching to populate the new guild's roster.
          </p>
        </div>
      </IslandCard>

      {/* Setting rows */}
      <div style={{ display: "grid", gap: 14 }}>
        {settings.map((setting) => {
          const meta = SERVER_CONFIG_META[setting.key];
          const draft = drafts[setting.key] ?? setting.value;
          const isDirty = draft !== setting.value;
          const isSaved = saved[setting.key];

          return (
            <IslandCard key={setting.key} style={{ padding: "16px 18px" }}>
              <div style={{ display: "grid", gap: 10 }}>
                {/* Label + key */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{setting.label}</span>
                  <code
                    className="island-mono"
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: islandTheme.color.panelMutedBg,
                      color: islandTheme.color.textMuted
                    }}
                  >
                    {setting.key}
                  </code>
                </div>

                {/* Description */}
                {setting.description ? (
                  <p style={{ margin: 0, fontSize: 12, color: islandTheme.color.textMuted, lineHeight: 1.5 }}>
                    {setting.description}
                  </p>
                ) : null}

                {/* Env default notice */}
                {setting.envDefault ? (
                  <div
                    className="island-mono"
                    style={{
                      fontSize: 11,
                      color: islandTheme.color.textMuted,
                      padding: "6px 10px",
                      borderRadius: 7,
                      background: islandTheme.color.panelMutedBg,
                      border: `1px solid ${islandTheme.color.cardBorder}`
                    }}
                  >
                    <span style={{ opacity: 0.6 }}>env fallback: </span>
                    <span>{setting.envDefault}</span>
                  </div>
                ) : null}

                {/* Hint */}
                {meta?.hint ? (
                  <p style={{ margin: 0, fontSize: 12, color: islandTheme.color.textMuted, fontStyle: "italic", lineHeight: 1.5 }}>
                    💡 {meta.hint}
                  </p>
                ) : null}

                {/* Input + save */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))
                    }
                    placeholder={setting.envDefault || `Enter ${setting.label.toLowerCase()}…`}
                    style={{ ...islandInputStyle, flex: 1 }}
                    spellCheck={false}
                  />
                  <IslandButton
                    variant={isSaved ? "secondary" : "primary"}
                    disabled={!isDirty && !isSaved}
                    onClick={() => handleSave(setting.key)}
                    style={{ flexShrink: 0, minWidth: 80 }}
                  >
                    {isSaved ? "✓ Saved" : "Save"}
                  </IslandButton>
                </div>
              </div>
            </IslandCard>
          );
        })}
      </div>
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

// ── AI Settings subpage ───────────────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini"
};

type ModelOption = { value: string; label: string; note?: string };

const PROVIDER_MODELS: Record<string, ModelOption[]> = {
  anthropic: [
    { value: "claude-haiku-4-5",   label: "Claude Haiku 4.5",   note: "Fastest · cheapest · great for bulk tasks" },
    { value: "claude-sonnet-4-6",  label: "Claude Sonnet 4.6",  note: "Best balance of speed and intelligence" },
    { value: "claude-opus-4-6",    label: "Claude Opus 4.6",    note: "Extended thinking · higher cost" },
    { value: "claude-opus-4-7",    label: "Claude Opus 4.7",    note: "Most capable · best for complex reasoning" },
    { value: "__custom__",         label: "Custom model…",      note: "Enter a model ID manually" }
  ],
  openai: [
    { value: "gpt-4o-mini",        label: "GPT-4o Mini",        note: "Fast · affordable · solid quality" },
    { value: "gpt-4o",             label: "GPT-4o",             note: "Flagship multimodal model" },
    { value: "gpt-4.1-mini",       label: "GPT-4.1 Mini",       note: "Efficient · low latency" },
    { value: "gpt-4.1",            label: "GPT-4.1",            note: "Latest GPT-4 generation" },
    { value: "o4-mini",            label: "o4-mini",            note: "Fast reasoning model" },
    { value: "__custom__",         label: "Custom model…",      note: "Enter a model ID manually" }
  ]
};

function AISettingsSubpage({
  settings,
  onUpdate,
  onTest
}: {
  settings: ServerSetting[] | null;
  onUpdate: (key: string, value: string) => void;
  onTest: (opts: { provider: string; model?: string; apiKey?: string }) => Promise<{ ok: boolean; provider?: string; model?: string; error?: string }>;
}) {
  const getSetting = (key: string) => settings?.find((s) => s.key === key)?.value ?? "";

  const [provider, setProvider] = useState(() => getSetting("ai_provider"));
  const [model, setModel] = useState(() => getSetting("ai_model"));
  const [customModel, setCustomModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(() => getSetting("ai_enabled") === "true");
  const [testState, setTestState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const apiKeyIsSet = getSetting("ai_api_key") === "••••••••";
  const initializedRef = useRef(false);

  // Derive whether the currently saved model is a known preset or custom
  const knownModels = provider ? (PROVIDER_MODELS[provider] ?? []).map((m) => m.value) : [];
  const isCustomSelected = model === "__custom__" || (model !== "" && !knownModels.includes(model) && model !== "__custom__");
  const selectValue = isCustomSelected ? "__custom__" : model;

  useEffect(() => {
    if (settings && !initializedRef.current) {
      const savedProvider = getSetting("ai_provider");
      const savedModel = getSetting("ai_model");
      setProvider(savedProvider);
      const knownForProvider = (PROVIDER_MODELS[savedProvider] ?? []).map((m) => m.value);
      if (savedModel && !knownForProvider.includes(savedModel)) {
        setModel("__custom__");
        setCustomModel(savedModel);
      } else {
        setModel(savedModel);
      }
      setEnabled(getSetting("ai_enabled") === "true");
      initializedRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = (key: string, value: string) => {
    onUpdate(key, value);
    setSaved((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2200);
  };

  const saveModel = () => {
    const actualModel = model === "__custom__" ? customModel.trim() : model;
    save("ai_model", actualModel);
  };

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setModel(PROVIDER_DEFAULTS[p] ?? "");
    setCustomModel("");
  };

  const handleModelSelect = (value: string) => {
    setModel(value);
    if (value !== "__custom__") setCustomModel("");
  };

  const handleTest = async () => {
    if (!provider) return;
    setTestState("running");
    setTestMsg("");
    const result = await onTest({ provider, model: model || undefined, apiKey: apiKey || undefined });
    if (result.ok) {
      setTestState("ok");
      setTestMsg(`Connected · ${result.provider} / ${result.model}`);
    } else {
      setTestState("error");
      setTestMsg(result.error ?? "Connection failed");
    }
    setTimeout(() => setTestState("idle"), 6000);
  };

  if (settings === null) {
    return (
      <IslandCard style={{ padding: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textMuted }}>Loading settings…</p>
      </IslandCard>
    );
  }

  const accent = "#8b5cf6";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Status banner */}
      <IslandCard
        style={{
          padding: "14px 18px",
          background: `linear-gradient(135deg, ${accent}22 0%, ${islandTheme.color.panelBg} 100%)`,
          border: `1px solid ${accent}44`
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div className="island-mono" style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              AI Engine
            </div>
            <div className="island-display" style={{ fontWeight: 800, fontSize: 18 }}>
              {provider ? `${provider.charAt(0).toUpperCase() + provider.slice(1)} · ${model || PROVIDER_DEFAULTS[provider] || "default model"}` : "Not configured"}
            </div>
            <div className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, marginTop: 2 }}>
              {enabled ? "AI features enabled" : "AI features disabled"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              save("ai_enabled", next ? "true" : "false");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: islandTheme.color.textSubtle,
              fontSize: 13,
              font: "inherit"
            }}
          >
            <Toggle on={enabled} />
            <span>{enabled ? "On" : "Off"}</span>
          </button>
        </div>
      </IslandCard>

      {/* Provider */}
      <IslandCard style={{ padding: "16px 18px" }}>
        <SubsectionTitle>Provider</SubsectionTitle>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          Choose your LLM provider. You can swap at any time — no code changes needed.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["anthropic", "openai"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: `1.5px solid ${provider === p ? accent : islandTheme.color.cardBorder}`,
                background: provider === p ? `${accent}22` : islandTheme.color.panelMutedBg,
                color: provider === p ? accent : islandTheme.color.textSecondary,
                fontWeight: provider === p ? 700 : 400,
                fontSize: 14,
                cursor: "pointer",
                font: "inherit",
                transition: "all 140ms"
              }}
            >
              {p === "anthropic" ? "Anthropic (Claude)" : "OpenAI (GPT)"}
            </button>
          ))}
        </div>
        {provider ? (
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <IslandButton
              variant="secondary"
              onClick={() => save("ai_provider", provider)}
              disabled={saved["ai_provider"]}
            >
              {saved["ai_provider"] ? "Saved" : "Save Provider"}
            </IslandButton>
          </div>
        ) : null}
      </IslandCard>

      {/* Model */}
      <IslandCard style={{ padding: "16px 18px" }}>
        <SubsectionTitle>Model</SubsectionTitle>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          {provider
            ? `Choose a ${provider === "anthropic" ? "Claude" : "GPT"} model. Haiku / Mini tiers are fastest and cheapest — great for news curation. Use Sonnet / GPT-4o for richer reasoning.`
            : "Select a provider above to see available models."}
        </p>

        {provider ? (
          <div style={{ display: "grid", gap: 10 }}>
            {/* Model option tiles */}
            <div style={{ display: "grid", gap: 6 }}>
              {(PROVIDER_MODELS[provider] ?? []).map((opt) => {
                const isSelected = selectValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleModelSelect(opt.value)}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? accent : islandTheme.color.cardBorder}`,
                      background: isSelected ? `${accent}18` : islandTheme.color.panelMutedBg,
                      color: islandTheme.color.textPrimary,
                      cursor: "pointer",
                      font: "inherit",
                      transition: "all 140ms",
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? accent : islandTheme.color.cardBorder}`,
                        background: isSelected ? accent : "transparent",
                        flexShrink: 0,
                        transition: "all 140ms"
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: isSelected ? 700 : 400, fontSize: 13 }}>
                        {opt.label}
                      </span>
                      {opt.note && opt.value !== "__custom__" ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            color: islandTheme.color.textMuted
                          }}
                        >
                          — {opt.note}
                        </span>
                      ) : null}
                    </span>
                    {opt.value === PROVIDER_DEFAULTS[provider] ? (
                      <span
                        className="island-mono"
                        style={{
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          background: `${accent}28`,
                          color: accent,
                          padding: "2px 7px",
                          borderRadius: 999
                        }}
                      >
                        Default
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Custom model input — only visible when Custom is selected */}
            {selectValue === "__custom__" ? (
              <input
                style={{ ...islandInputStyle }}
                type="text"
                placeholder={`Enter model ID (e.g. ${provider === "anthropic" ? "claude-opus-4-5" : "gpt-4-turbo"})`}
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                autoFocus
              />
            ) : null}

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IslandButton
                variant="secondary"
                onClick={saveModel}
                disabled={saved["ai_model"] || (selectValue === "__custom__" && !customModel.trim())}
              >
                {saved["ai_model"] ? "Saved" : "Save Model"}
              </IslandButton>
              {saved["ai_model"] ? null : (
                <span style={{ fontSize: 12, color: islandTheme.color.textMuted }}>
                  Currently:{" "}
                  <span className="island-mono" style={{ color: islandTheme.color.textSubtle }}>
                    {getSetting("ai_model") || `${PROVIDER_DEFAULTS[provider] ?? "default"} (default)`}
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: islandTheme.color.panelMutedBg,
              border: `1px solid ${islandTheme.color.cardBorder}`,
              fontSize: 13,
              color: islandTheme.color.textMuted
            }}
          >
            No provider selected — pick one above to see model options.
          </div>
        )}
      </IslandCard>

      {/* API Key */}
      <IslandCard style={{ padding: "16px 18px" }}>
        <SubsectionTitle>API Key</SubsectionTitle>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          {apiKeyIsSet
            ? "A key is already saved. Enter a new value to replace it, or leave blank to keep the existing key."
            : "Your key is stored server-side and never returned to the browser after saving. You can also set ANTHROPIC_API_KEY / OPENAI_API_KEY in your .env as a fallback."}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ ...islandInputStyle, flex: 1, fontFamily: islandTheme.font.mono, letterSpacing: "0.05em" }}
            type="password"
            value={apiKey}
            placeholder={apiKeyIsSet ? "••••••••  (key saved — enter new to replace)" : "sk-ant-... or sk-..."}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
          <IslandButton
            variant="secondary"
            onClick={() => {
              if (apiKey) {
                save("ai_api_key", apiKey);
                setApiKey("");
              }
            }}
            disabled={!apiKey || saved["ai_api_key"]}
          >
            {saved["ai_api_key"] ? "Saved" : "Save Key"}
          </IslandButton>
        </div>
      </IslandCard>

      {/* Test connection */}
      <IslandCard style={{ padding: "16px 18px" }}>
        <SubsectionTitle>Test Connection</SubsectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          Sends a short ping to the provider using the current settings (including any unsaved key entered above).
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IslandButton
            variant="primary"
            onClick={handleTest}
            disabled={!provider || testState === "running"}
          >
            {testState === "running" ? "Testing…" : "Test Connection"}
          </IslandButton>
          {testMsg ? (
            <span
              className="island-mono"
              style={{
                fontSize: 12,
                color: testState === "ok" ? islandTheme.color.success : islandTheme.color.danger,
                lineHeight: 1.4
              }}
            >
              {testState === "ok" ? "✓ " : "✗ "}{testMsg}
            </span>
          ) : null}
        </div>
      </IslandCard>
    </div>
  );
}
