import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type { GuildMember, MeProfile, PageId } from "../types.js";

type HomePageProps = {
  profile: MeProfile | null;
  activeMembers: GuildMember[];
  totalMemberCount: number;
  onNavigate: (page: PageId) => void;
};

export function HomePage({ profile, activeMembers, totalMemberCount, onNavigate }: HomePageProps) {
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <Hero profile={profile} onlineCount={activeMembers.length} onNavigate={onNavigate} />
      <FeaturedAndFriendsRow
        activeMembers={activeMembers}
        totalMemberCount={totalMemberCount}
        onNavigate={onNavigate}
      />
      <ActivityFeed />
      <DriftLog />
      <BotAndRitualRow />
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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <HeroButton variant="primary" onClick={() => scrollTo("activity")}>
          See what's happening →
        </HeroButton>
        <HeroButton variant="ghost" onClick={() => onNavigate("games")}>
          Browse games
        </HeroButton>
      </div>

      <div
        className="island-mono"
        style={{
          marginTop: 8,
          fontSize: 11,
          color: islandTheme.color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.12em"
        }}
      >
        scroll past the palms ↓
      </div>
    </section>
  );
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  onNavigate
}: {
  activeMembers: GuildMember[];
  totalMemberCount: number;
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
      <FeaturedGame onNavigate={onNavigate} />
      <FriendsOnline
        activeMembers={activeMembers}
        totalMemberCount={totalMemberCount}
        onNavigate={onNavigate}
      />
    </section>
  );
}

function FeaturedGame({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <article
      onClick={() => onNavigate("games")}
      style={{
        position: "relative",
        cursor: "pointer",
        background: `linear-gradient(135deg, rgba(37, 99, 235, 0.32) 0%, ${islandTheme.color.panelBg} 70%)`,
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
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 24px 50px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "relative", zIndex: 1, maxWidth: "62%" }}>
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
          ★ Game of the Month
        </div>
        <h2
          className="island-display"
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(22px, 3vw, 30px)",
            lineHeight: 1.1
          }}
        >
          Deep Sea Dunkers: The Kraken's Hoard
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 14,
            lineHeight: 1.45,
            opacity: 0.92,
            color: islandTheme.color.textSubtle
          }}
        >
          Co-op submarine looting in haunted reefs. 4 friends own it, voting opens Friday.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <HeroButton variant="primary" onClick={() => onNavigate("games")}>
            Play Now
          </HeroButton>
          <HeroButton variant="ghost" onClick={() => onNavigate("games")}>
            Details
          </HeroButton>
        </div>
      </div>
      <SubmarineArt />
    </article>
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

type ActivityCategory = "all" | "friends" | "achievements" | "milestones" | "patches";

type ActivityItem = {
  id: string;
  category: Exclude<ActivityCategory, "all">;
  initials: string;
  color: string;
  icon: string;
  metaText: string;
  body: ReactNode;
  attachment?: { icon: string; title: string; meta: string };
};

const ACTIVITY_MOCK: ActivityItem[] = [
  {
    id: "ach-1",
    category: "achievements",
    initials: "AL",
    color: "#a855f7",
    icon: "🏆",
    metaText: "4m ago · 5/120 friends have this",
    body: (
      <>
        <strong>aloha-pirate</strong> unlocked <Achievement>Secret Cove</Achievement> in <Target>Deep Sea Dunkers</Target>.
      </>
    )
  },
  {
    id: "mil-1",
    category: "milestones",
    initials: "JK",
    color: "#22d3ee",
    icon: "⚡",
    metaText: "22m ago",
    body: (
      <>
        <strong>jkraken</strong> set a new lap record in <Target>Cosmic Cruiser</Target>.
      </>
    ),
    attachment: { icon: "🚀", title: "Helix-IV · 1:42.08", meta: "−3.4s vs prev best · ranked #4 island board" }
  },
  {
    id: "frd-1",
    category: "friends",
    initials: "DM",
    color: "#f4a261",
    icon: "🌴",
    metaText: "1h ago · 6 of 24 going",
    body: (
      <>
        <strong>donmega</strong> RSVP'd to <Target>Friday Island Session</Target>.
      </>
    )
  },
  {
    id: "frd-2",
    category: "friends",
    initials: "PW",
    color: "#fbbf77",
    icon: "💬",
    metaText: "2h ago · 4 replies",
    body: (
      <>
        <strong>palmwave</strong> posted in <Target>#cozy-corner</Target>: "Year 4 Spring is wild, the greenhouse went feral 🌿"
      </>
    )
  },
  {
    id: "ach-2",
    category: "achievements",
    initials: "SN",
    color: "#4ade80",
    icon: "🏆",
    metaText: "4h ago · in Deep Rock Galactic",
    body: (
      <>
        <strong>sandnugget</strong> earned <Achievement>100 Hours Co-op</Achievement>.
      </>
    )
  },
  {
    id: "patch-1",
    category: "patches",
    initials: "🦑",
    color: "#0ea5e9",
    icon: "🦑",
    metaText: "5h ago · 5 friends own this",
    body: (
      <>
        <strong>Helldivers II</strong> dropped a new Major Order — the Squid Front opened up.
      </>
    )
  },
  {
    id: "mil-2",
    category: "milestones",
    initials: "RT",
    color: "#ef8354",
    icon: "📈",
    metaText: "9h ago",
    body: (
      <>
        <strong>reeftroll</strong> hit <Achievement>Tier 30</Achievement> in <Target>Risk of Rain 2</Target>.
      </>
    )
  },
  {
    id: "frd-3",
    category: "friends",
    initials: "EM",
    color: "#86efac",
    icon: "🪸",
    metaText: "yesterday",
    body: (
      <>
        <strong>emberfish</strong> joined the <Target>Cozy Players</Target> guild.
      </>
    )
  }
];

function Achievement({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        color: islandTheme.palette.sandWarmAccent,
        fontWeight: 600
      }}
    >
      {children}
    </span>
  );
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

function ActivityFeed() {
  const [tab, setTab] = useState<ActivityCategory>("all");
  const visible = useMemo(
    () => (tab === "all" ? ACTIVITY_MOCK : ACTIVITY_MOCK.filter((a) => a.category === tab)),
    [tab]
  );
  return (
    <section id="activity" style={{ display: "grid", gap: 14 }}>
      <SectionHead
        title="Activity feed"
        meta="Latest from your friends, the games you follow, and the patch firehose."
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
        <div style={{ padding: 6 }}>
          {visible.map((item, i) => (
            <ActivityRow key={item.id} item={item} firstRow={i === 0} />
          ))}
        </div>
      </IslandCard>
    </section>
  );
}

function ActivityRow({ item, firstRow }: { item: ActivityItem; firstRow: boolean }) {
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
          background: item.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 800,
          color: "#0f172a"
        }}
      >
        {item.initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, lineHeight: 1.45, color: islandTheme.color.textSubtle }}>
          {item.body}
        </div>
        {item.attachment ? (
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
                background: "rgba(96, 165, 250, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22
              }}
            >
              {item.attachment.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.attachment.title}</div>
              <div style={{ fontSize: 12, color: islandTheme.color.textMuted, marginTop: 2 }}>
                {item.attachment.meta}
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
          <span>{item.icon}</span>
          {item.metaText}
        </div>
      </div>
      <button
        type="button"
        aria-label="More"
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          background: "transparent",
          color: islandTheme.color.textMuted,
          cursor: "pointer",
          fontSize: 14
        }}
      >
        ⋯
      </button>
    </div>
  );
}

const NEWS_MOCK: Array<{ icon: string; title: string; meta: string }> = [
  { icon: "🦑", title: "Helldivers II: New Major Order drops the Squid Front", meta: "curated · co-op · 4h ago" },
  { icon: "⛏️", title: "Deep Rock Season 6 teaser — molly's getting an upgrade", meta: "curated · co-op · 1d ago" },
  { icon: "🌾", title: "Stardew 1.6.9 patch: tiny tweaks, big morale boost", meta: "curated · cozy · 2d ago" },
  { icon: "👻", title: "Lethal Company V60 — new moon, new ways to die", meta: "curated · horror · 3d ago" },
  { icon: "🌊", title: "Rust + Steam Deck: a friendlier shoreline build", meta: "curated · survival · 4d ago" },
  { icon: "🧨", title: "Risk of Rain Returns DLC roadmap leaked from a coconut", meta: "curated · roguelite · 5d ago" }
];

function DriftLog() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <SectionHead
        title="Washed up on shore"
        meta="Drift log: news, patch notes, and crew gossip from the curated feed."
        action="Full feed →"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12
        }}
      >
        {NEWS_MOCK.map((n) => (
          <NewsCard key={n.title} icon={n.icon} title={n.title} meta={n.meta} />
        ))}
      </div>
    </section>
  );
}

function NewsCard({ icon, title, meta }: { icon: string; title: string; meta: string }) {
  return (
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
        cursor: "pointer",
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
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
        <div className="island-mono" style={{ marginTop: 4, fontSize: 11, color: islandTheme.color.textMuted }}>
          {meta}
        </div>
      </div>
    </article>
  );
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
