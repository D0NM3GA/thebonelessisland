import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type {
  ActivityCategory,
  ActivityEvent,
  FeaturedRecommendation,
  GuildMember,
  MeProfile,
  NewsCard as NewsCardData,
  PageId
} from "../types.js";

type HomePageProps = {
  profile: MeProfile | null;
  activeMembers: GuildMember[];
  totalMemberCount: number;
  featured: FeaturedRecommendation | null;
  activityEvents: ActivityEvent[];
  newsCards: NewsCardData[];
  onNavigate: (page: PageId) => void;
};

type HeroPhase = "visible" | "fading" | "collapsing" | "gone";

export function HomePage({
  profile,
  activeMembers,
  totalMemberCount,
  featured,
  activityEvents,
  newsCards,
  onNavigate
}: HomePageProps) {
  const [heroPhase, setHeroPhase] = useState<HeroPhase>("visible");

  useEffect(() => {
    const t1 = setTimeout(() => setHeroPhase("fading"), 1100);
    const t2 = setTimeout(() => setHeroPhase("collapsing"), 1500);
    const t3 = setTimeout(() => setHeroPhase("gone"), 2050);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div>
      {heroPhase !== "gone" && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: heroPhase === "collapsing" ? "0fr" : "1fr",
            opacity: heroPhase === "visible" ? 1 : 0,
            marginBottom: heroPhase === "collapsing" ? 0 : 28,
            transition:
              heroPhase === "collapsing"
                ? "grid-template-rows 500ms cubic-bezier(0.4,0,0.2,1), margin-bottom 500ms cubic-bezier(0.4,0,0.2,1)"
                : "opacity 360ms ease"
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <Hero profile={profile} onlineCount={activeMembers.length} onNavigate={onNavigate} />
          </div>
        </div>
      )}
      <div style={{ display: "grid", gap: 28 }}>
        <FeaturedAndFriendsRow
          activeMembers={activeMembers}
          totalMemberCount={totalMemberCount}
          featured={featured}
          onNavigate={onNavigate}
        />
        <ActivityFeed events={activityEvents} />
        <DriftLog cards={newsCards} />
        <BotAndRitualRow />
      </div>
    </div>
  );
}

function Hero({
  profile,
  onlineCount,
  onNavigate
}: {
  profile: MeProfile | null;
  onlineCount: number;
  onNavigate: (page: PageId) => void;
}) {
  const name = profile?.displayName ?? "friend";
  return (
    <section
      style={{
        position: "relative",
        padding: "48px clamp(16px, 3vw, 32px) 56px",
        textAlign: "center",
        minHeight: "55vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 20
      }}
    >
      <span
        className="island-mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          borderRadius: 999,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          background: islandTheme.color.panelMutedBg,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: islandTheme.color.textMuted
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#4ade80",
            boxShadow: "0 0 0 4px rgba(74, 222, 128, 0.18)"
          }}
        />
        {onlineCount} on the island right now
      </span>

      <h1
        className="island-display"
        style={{
          margin: 0,
          fontSize: "clamp(38px, 6vw, 68px)",
          fontWeight: 800,
          lineHeight: 1.08,
          textShadow: "0 4px 28px rgba(0,0,0,0.45)"
        }}
      >
        Welcome back,
        <br />
        <span style={{ fontStyle: "italic", color: islandTheme.palette.sandWarmAccent }}>{name}</span>
      </h1>

      <p
        style={{
          margin: 0,
          maxWidth: 560,
          fontSize: 16,
          lineHeight: 1.5,
          color: islandTheme.color.textSubtle,
          opacity: 0.95
        }}
      >
        Game nights, low-stakes co-op, and a lounge that lives on Discord. Here's what's happening on the island today.
      </p>

      <HeroButton variant="ghost" onClick={() => onNavigate("games")}>
        Browse games
      </HeroButton>
    </section>
  );
}


type HeroButtonProps = {
  variant: "primary" | "ghost";
  onClick: () => void;
  children: ReactNode;
};

function HeroButton({ variant, onClick, children }: HeroButtonProps) {
  const style: CSSProperties =
    variant === "primary"
      ? {
          background: islandTheme.color.primary,
          border: `1px solid ${islandTheme.color.primary}`,
          color: islandTheme.color.primaryText
        }
      : {
          background: "transparent",
          border: `1px solid ${islandTheme.color.cardBorder}`,
          color: islandTheme.color.textPrimary
        };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...style,
        padding: "10px 18px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        font: "inherit"
      }}
    >
      {children}
    </button>
  );
}

function FeaturedAndFriendsRow({
  activeMembers,
  totalMemberCount,
  featured,
  onNavigate
}: {
  activeMembers: GuildMember[];
  totalMemberCount: number;
  featured: FeaturedRecommendation | null;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 16,
        alignItems: "stretch"
      }}
    >
      <FeaturedGame featured={featured} onNavigate={onNavigate} />
      <FriendsOnline
        activeMembers={activeMembers}
        totalMemberCount={totalMemberCount}
        onNavigate={onNavigate}
      />
    </section>
  );
}

function FeaturedGame({
  featured,
  onNavigate
}: {
  featured: FeaturedRecommendation | null;
  onNavigate: (page: PageId) => void;
}) {
  const baseStyle: CSSProperties = {
    position: "relative",
    cursor: "pointer",
    backdropFilter: islandTheme.glass.blur,
    WebkitBackdropFilter: islandTheme.glass.blur,
    border: `1px solid ${islandTheme.color.cardBorder}`,
    borderRadius: 18,
    padding: "28px 28px 24px",
    overflow: "hidden",
    minHeight: 240,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    transition: "transform 200ms ease, box-shadow 200ms ease"
  };

  const tintedBackground = `linear-gradient(135deg, rgba(37, 99, 235, 0.32) 0%, ${islandTheme.color.panelBg} 70%)`;

  const backgroundStyle: CSSProperties = featured?.headerImageUrl
    ? {
        backgroundImage: `linear-gradient(115deg, rgba(8, 16, 34, 0.86) 35%, rgba(8, 16, 34, 0.55) 65%, rgba(8, 16, 34, 0.2) 100%), url("${featured.headerImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }
    : { background: tintedBackground };

  if (!featured) {
    return (
      <article
        onClick={() => onNavigate("games")}
        style={{ ...baseStyle, ...backgroundStyle }}
      >
        <div style={{ position: "relative", zIndex: 1, maxWidth: "62%" }}>
          <Eyebrow>★ Featured pick · pending</Eyebrow>
          <FeaturedTitle>Sync the crew's libraries to surface a pick</FeaturedTitle>
          <FeaturedBody>
            We score every game by crew overlap, group fit, and session length. Link a Steam account from Profile or
            ask a crewmate to run a sync — the strongest pick will land here.
          </FeaturedBody>
          <div style={{ display: "flex", gap: 10 }}>
            <HeroButton variant="primary" onClick={() => onNavigate("profile")}>
              Link Steam
            </HeroButton>
            <HeroButton variant="ghost" onClick={() => onNavigate("games")}>
              Plan a session
            </HeroButton>
          </div>
        </div>
        <SubmarineArt />
      </article>
    );
  }

  const matchPct = Math.max(0, Math.min(100, Math.round(featured.score)));
  const sessionLabel =
    typeof featured.medianSessionMinutes === "number" && featured.medianSessionMinutes > 0
      ? `~${featured.medianSessionMinutes}m sessions`
      : null;
  const playerLabel =
    typeof featured.maxPlayers === "number" && featured.maxPlayers > 1 ? `up to ${featured.maxPlayers}p` : null;
  const tagLabel = featured.tags[0]?.toLowerCase() ?? null;

  return (
    <article
      onClick={() => onNavigate("games")}
      style={{ ...baseStyle, ...backgroundStyle }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 24px 50px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "relative", zIndex: 1, maxWidth: "64%" }}>
        <Eyebrow>★ Featured pick · {matchPct}% match</Eyebrow>
        <FeaturedTitle>{featured.name}</FeaturedTitle>
        <FeaturedBody>
          {featured.owners} of {featured.scopeMemberCount} on the island own it. {featured.reason}.
        </FeaturedBody>
        <FeaturedMetaRow items={[playerLabel, sessionLabel, tagLabel].filter((value): value is string => Boolean(value))} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <HeroButton variant="primary" onClick={() => onNavigate("games")}>
            Plan tonight
          </HeroButton>
          <HeroButton variant="ghost" onClick={() => onNavigate("library")}>
            Open library
          </HeroButton>
        </div>
      </div>
      {featured.headerImageUrl ? null : <SubmarineArt />}
    </article>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      className="island-mono"
      style={{
        fontSize: 11,
        color: islandTheme.palette.sandWarmAccent,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 10
      }}
    >
      {children}
    </div>
  );
}

function FeaturedTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="island-display"
      style={{
        margin: "0 0 10px",
        fontSize: "clamp(22px, 3vw, 30px)",
        lineHeight: 1.1
      }}
    >
      {children}
    </h2>
  );
}

function FeaturedBody({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 12px",
        fontSize: 14,
        lineHeight: 1.45,
        opacity: 0.92,
        color: islandTheme.color.textSubtle
      }}
    >
      {children}
    </p>
  );
}

function FeaturedMetaRow({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="island-mono"
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        fontSize: 11,
        color: islandTheme.color.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      }}
    >
      {items.map((item, index) => (
        <span key={`${item}-${index}`}>
          {index > 0 ? <span style={{ marginRight: 10, opacity: 0.6 }}>·</span> : null}
          {item}
        </span>
      ))}
    </div>
  );
}

function SubmarineArt() {
  return (
    <svg
      viewBox="0 0 220 200"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: "min(34%, 240px)",
        height: "auto",
        filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.35))"
      }}
    >
      <defs>
        <radialGradient id="dunkersBg" cx="0.5" cy="0.5">
          <stop offset="0" stopColor="#fcd34d" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={110} cy={100} r={90} fill="url(#dunkersBg)" />
      <ellipse cx={110} cy={120} rx={80} ry={38} fill="#fbbf24" stroke="#92400e" strokeWidth={3} />
      <ellipse cx={110} cy={120} rx={80} ry={38} fill="none" stroke="#fde68a" strokeWidth={1.5} opacity={0.6} />
      <circle cx={80} cy={118} r={10} fill="#0c4a6e" stroke="#92400e" strokeWidth={2} />
      <circle cx={110} cy={118} r={10} fill="#0c4a6e" stroke="#92400e" strokeWidth={2} />
      <circle cx={140} cy={118} r={10} fill="#0c4a6e" stroke="#92400e" strokeWidth={2} />
      <rect x={98} y={75} width={24} height={22} rx={4} fill="#fbbf24" stroke="#92400e" strokeWidth={2.5} />
      <ellipse cx={110} cy={64} rx={14} ry={13} fill="#fde68a" stroke="#92400e" strokeWidth={2} />
      <path d="M 96 60 q 14 -10 28 0 v -4 q -14 -8 -28 0 z" fill="#0f172a" />
      <rect x={96} y={56} width={28} height={3} fill="#0f172a" />
      <circle cx={113} cy={63} r={1.6} fill="#0f172a" />
      <path d="M 102 64 l 4 -2 l 2 4 z" fill="#0f172a" />
      <circle cx={32} cy={120} r={9} fill="#92400e" />
      <line x1={32} y1={111} x2={32} y2={129} stroke="#fde68a" strokeWidth={3} />
      <line x1={23} y1={120} x2={41} y2={120} stroke="#fde68a" strokeWidth={3} />
      <path d="M 190 115 l 18 -10 l 0 30 z" fill="#fbbf24" stroke="#92400e" strokeWidth={2} />
      <circle cx={20} cy={60} r={4} fill="rgba(255,255,255,0.5)" />
      <circle cx={35} cy={40} r={3} fill="rgba(255,255,255,0.4)" />
      <circle cx={50} cy={55} r={2} fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function FriendsOnline({
  activeMembers,
  totalMemberCount,
  onNavigate
}: {
  activeMembers: GuildMember[];
  totalMemberCount: number;
  onNavigate: (page: PageId) => void;
}) {
  const display = activeMembers.slice(0, 5);
  return (
    <IslandCard
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 18
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="island-display" style={{ margin: 0, fontSize: 17 }}>
          Friends online
        </h3>
        <span
          className="island-mono"
          style={{ fontSize: 11, color: islandTheme.color.textMuted }}
        >
          {activeMembers.length} / {totalMemberCount || "—"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {display.length ? (
          display.map((m) => <CrewRow key={m.discordUserId} member={m} />)
        ) : (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
            Quiet shoreline right now. Crew sync runs every minute.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onNavigate("community")}
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
        All {totalMemberCount || "—"} crew →
      </button>
    </IslandCard>
  );
}

function CrewRow({ member }: { member: GuildMember }) {
  const status = member.inVoice ? "voice" : member.richPresenceText ? "active" : "idle";
  const presence = member.richPresenceText ?? (member.inVoice ? "in voice" : "online");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "6px 8px",
        borderRadius: 10,
        background: islandTheme.color.panelMutedBg,
        border: `1px solid ${islandTheme.color.cardBorder}`
      }}
    >
      <CrewAvatar member={member} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {member.displayName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: islandTheme.color.textMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {presence}
        </div>
      </div>
      <span
        className="island-mono"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color:
            status === "voice"
              ? "#4ade80"
              : status === "active"
                ? islandTheme.color.primaryGlow
                : islandTheme.color.textMuted
        }}
      >
        {status === "voice" ? "voice" : status === "active" ? "online" : "idle"}
      </span>
    </div>
  );
}

function CrewAvatar({ member }: { member: GuildMember }) {
  const initials = (member.displayName || member.username || "??").slice(0, 2).toUpperCase();
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt=""
        style={{ width: 32, height: 32, borderRadius: 999, objectFit: "cover" }}
      />
    );
  }
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        background: pickColorFor(member.discordUserId),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 800,
        color: "#0f172a"
      }}
    >
      {initials}
    </div>
  );
}

const AVATAR_PALETTE = ["#fbbf77", "#22d3ee", "#a855f7", "#4ade80", "#ef8354", "#86efac", "#facc15"];

function pickColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function Target({ children }: { children: ReactNode }) {
  return (
    <span style={{ color: islandTheme.color.primaryGlow, fontWeight: 600 }}>{children}</span>
  );
}

const ACTIVITY_TABS: Array<{ id: ActivityCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "friends", label: "Friends" },
  { id: "achievements", label: "Achievements" },
  { id: "milestones", label: "Milestones" },
  { id: "patches", label: "Patch notes" }
];

const ACTOR_COLORS = ["#22d3ee", "#a855f7", "#f4a261", "#86efac", "#fbbf77", "#ef8354", "#4ade80", "#60a5fa"];

function colorForActor(id: string | null | undefined): string {
  if (!id) return ACTOR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACTOR_COLORS[hash % ACTOR_COLORS.length];
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function relativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const delta = Math.max(0, Date.now() - then);
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

type ActivityRendered = {
  body: ReactNode;
  icon: string;
  metaText: string;
};

function describeEvent(event: ActivityEvent): ActivityRendered | null {
  const actorName = event.actor?.displayName ?? "A crew member";
  const game = event.game;
  const ago = relativeAgo(event.createdAt);
  const payload = event.payload as Record<string, unknown>;

  switch (event.eventType) {
    case "game_night.created": {
      const title = typeof payload.title === "string" ? payload.title : "a new session";
      return {
        icon: "🌴",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> scheduled <Target>{title}</Target>.
          </>
        )
      };
    }
    case "game_night.rsvp_joined":
      return {
        icon: "🪵",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> RSVP'd to the next <Target>game night</Target>.
          </>
        )
      };
    case "game_night.rsvp_left":
      return {
        icon: "🌫",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> stepped off the dock for the next session.
          </>
        )
      };
    case "game_night.game_picked":
      return {
        icon: "🎯",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> locked in <Target>{game?.name ?? "a game"}</Target> for the next session.
          </>
        )
      };
    case "steam.linked":
      return {
        icon: "🔗",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> wired up their <Target>Steam library</Target>.
          </>
        )
      };
    case "steam.unlinked":
      return {
        icon: "🪢",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> unhooked their Steam library.
          </>
        )
      };
    case "steam.synced": {
      const synced = typeof payload.syncedGames === "number" ? payload.syncedGames : 0;
      return {
        icon: "🔄",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> resynced their library — <Target>{synced} game{synced === 1 ? "" : "s"}</Target>.
          </>
        )
      };
    }
    default:
      return {
        icon: "✨",
        metaText: ago,
        body: (
          <>
            <strong>{actorName}</strong> · {event.eventType}
          </>
        )
      };
  }
}

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [tab, setTab] = useState<ActivityCategory>("all");
  const visible = useMemo(
    () => (tab === "all" ? events : events.filter((e) => e.category === tab)),
    [events, tab]
  );
  return (
    <section id="activity" style={{ display: "grid", gap: 14 }}>
      <SectionHead
        title="Activity feed"
        meta="Latest from your crew — RSVPs, game picks, and library syncs."
        action="Open community →"
      />
      <IslandCard style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 8,
            borderBottom: `1px solid ${islandTheme.color.cardBorder}`
          }}
        >
          {ACTIVITY_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  border: "none",
                  background: active ? "rgba(37, 99, 235, 0.22)" : "transparent",
                  color: active ? islandTheme.color.textPrimary : islandTheme.color.textSubtle,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 999,
                  cursor: "pointer",
                  font: "inherit"
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: 6, maxHeight: 480, overflowY: "auto" }}>
          {visible.length === 0 ? (
            <div style={{ padding: "24px 14px", fontSize: 13, color: islandTheme.color.textMuted, textAlign: "center" }}>
              {events.length === 0
                ? "No island activity yet — schedule a game night or sync your library to get the dock buzzing."
                : "Nothing in this category right now."}
            </div>
          ) : (
            visible.map((event, i) => <ActivityRow key={event.id} event={event} firstRow={i === 0} />)
          )}
        </div>
      </IslandCard>
    </section>
  );
}

function ActivityRow({ event, firstRow }: { event: ActivityEvent; firstRow: boolean }) {
  const rendered = describeEvent(event);
  if (!rendered) return null;
  const actorAvatar = event.actor?.avatarUrl ?? null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 12,
        padding: "12px 10px",
        borderTop: firstRow ? "none" : `1px solid ${islandTheme.color.cardBorder}`,
        alignItems: "start"
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: actorAvatar
            ? `center / cover no-repeat url(${JSON.stringify(actorAvatar)})`
            : colorForActor(event.actor?.discordUserId ?? null),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 800,
          color: "#0f172a"
        }}
      >
        {actorAvatar ? null : initialsFor(event.actor?.displayName ?? null)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, lineHeight: 1.45, color: islandTheme.color.textSubtle }}>
          {rendered.body}
        </div>
        {event.game?.headerImageUrl ? (
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "44px 1fr",
              gap: 10,
              alignItems: "center",
              padding: "8px 10px",
              borderRadius: 10,
              background: islandTheme.color.panelMutedBg,
              border: `1px solid ${islandTheme.color.cardBorder}`
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: `center / cover no-repeat url(${JSON.stringify(event.game.headerImageUrl)})`
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{event.game.name}</div>
              <div style={{ fontSize: 12, color: islandTheme.color.textMuted, marginTop: 2 }}>
                Featured game
              </div>
            </div>
          </div>
        ) : null}
        <div
          className="island-mono"
          style={{
            marginTop: 6,
            fontSize: 11,
            color: islandTheme.color.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <span>{rendered.icon}</span>
          {rendered.metaText}
        </div>
      </div>
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          color: islandTheme.color.textMuted,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        ⋯
      </span>
    </div>
  );
}

function DriftLog({ cards }: { cards: NewsCardData[] }) {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <SectionHead
        title="Washed up on shore"
        meta="Drift log: news, patch notes, and crew gossip curated by the parents."
        action="Full feed →"
      />
      {cards.length === 0 ? (
        <IslandCard style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.55 }}>
            The drift log is quiet right now. Parents can post news cards from the Admin → News Curation page.
          </div>
        </IslandCard>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12
          }}
        >
          {cards.map((card) => (
            <NewsCardTile key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewsCardTile({ card }: { card: NewsCardData }) {
  const ago = relativeAgo(card.publishedAt);
  const tag = card.tag ? card.tag : "drift log";
  const meta = `${tag} · ${ago}`;
  const content = (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: islandTheme.color.panelBg,
        backdropFilter: islandTheme.glass.blur,
        WebkitBackdropFilter: islandTheme.glass.blur,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        cursor: card.sourceUrl ? "pointer" : "default",
        transition: "border-color 140ms ease, transform 140ms ease"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = islandTheme.color.primaryGlow;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = islandTheme.color.cardBorder;
        e.currentTarget.style.transform = "translateY(0)";
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
        {card.icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{card.title}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
          {card.body}
        </div>
        <div className="island-mono" style={{ marginTop: 6, fontSize: 11, color: islandTheme.color.textMuted }}>
          {meta}
        </div>
      </div>
    </article>
  );
  if (card.sourceUrl) {
    return (
      <a
        href={card.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {content}
      </a>
    );
  }
  return content;
}

function BotAndRitualRow() {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14
      }}
    >
      <CtaCard
        accent={islandTheme.color.primaryGlow}
        eyebrow="Try the bot"
        title="/whatcanweplay"
        body="Drop the slash command in any island channel. The bot pings the API, scans the crew's libraries, and surfaces overlap and near-matches in three seconds."
        ctaLabel="Open in Discord ↗"
        primary
      />
      <CtaCard
        accent={islandTheme.palette.sandWarmAccent}
        eyebrow="Crew ritual"
        title="Tide check, every Sunday"
        body="The island sends one weekly digest: who showed up, what got played, what's queued. Quiet, opt-in, never pings the off-duty."
        ctaLabel="See last week's tide →"
        primary={false}
      />
    </section>
  );
}

type CtaCardProps = {
  accent: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  primary: boolean;
};

function CtaCard({ accent, eyebrow, title, body, ctaLabel, primary }: CtaCardProps) {
  return (
    <article
      style={{
        background: `linear-gradient(135deg, ${hexToRgba(accent, primary ? 0.32 : 0.22)} 0%, ${islandTheme.color.panelBg} 100%)`,
        backdropFilter: islandTheme.glass.blur,
        WebkitBackdropFilter: islandTheme.glass.blur,
        border: `1px solid ${hexToRgba(accent, 0.4)}`,
        borderRadius: 16,
        padding: 28
      }}
    >
      <div
        className="island-mono"
        style={{
          fontSize: 11,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 10
        }}
      >
        {eyebrow}
      </div>
      <div
        className="island-display"
        style={{ fontSize: 24, marginBottom: 8, fontWeight: 800, letterSpacing: "-0.01em" }}
      >
        {title}
      </div>
      <p
        style={{
          margin: "0 0 14px",
          color: islandTheme.color.textSubtle,
          fontSize: 14,
          lineHeight: 1.5
        }}
      >
        {body}
      </p>
      <button
        type="button"
        style={{
          background: primary ? islandTheme.color.primary : "transparent",
          border: `1px solid ${primary ? islandTheme.color.primary : islandTheme.color.cardBorder}`,
          color: primary ? islandTheme.color.primaryText : islandTheme.color.textPrimary,
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          font: "inherit"
        }}
      >
        {ctaLabel}
      </button>
    </article>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("#") && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

function SectionHead({
  title,
  meta,
  action
}: {
  title: string;
  meta: string;
  action: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 12,
        flexWrap: "wrap"
      }}
    >
      <div>
        <h2 className="island-display" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          {title}
        </h2>
        <div
          className="island-mono"
          style={{ marginTop: 4, fontSize: 11, color: islandTheme.color.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {meta}
        </div>
      </div>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        style={{
          color: islandTheme.color.primaryGlow,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none"
        }}
      >
        {action}
      </a>
    </div>
  );
}
