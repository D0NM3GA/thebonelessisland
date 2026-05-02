import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";
import type {
  ActivityCategory,
  ActivityEvent,
  GeneralNewsItem,
  GuildMember,
  MeProfile,
  NewsCard as NewsCardData,
  PageId
} from "../types.js";

type HomePageProps = {
  profile: MeProfile | null;
  activeMembers: GuildMember[];
  totalMemberCount: number;
  generalNews: GeneralNewsItem[];
  activityEvents: ActivityEvent[];
  newsCards: NewsCardData[];
  onNavigate: (page: PageId) => void;
};

type HeroPhase = "visible" | "fading" | "collapsing" | "gone";

export function HomePage({
  profile,
  activeMembers,
  totalMemberCount,
  generalNews,
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
        <NewsAndFriendsRow
          generalNews={generalNews}
          activeMembers={activeMembers}
          totalMemberCount={totalMemberCount}
          onNavigate={onNavigate}
        />
        <ActivityFeed events={activityEvents} onNavigate={onNavigate} />
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

// ── Gaming News Feed ──────────────────────────────────────────────────────────

type NewsTab = "all" | "top_news" | "community" | "personal";

const NEWS_TABS: Array<{ id: NewsTab; label: string; emoji: string }> = [
  { id: "all", label: "All", emoji: "" },
  { id: "top_news", label: "Breaking", emoji: "🔥" },
  { id: "community", label: "Trending", emoji: "🌊" },
  { id: "personal", label: "Your games", emoji: "🎮" }
];

const LABEL_COLORS: Record<string, string> = {
  top_news: "#f59e0b",
  community: "#22d3ee",
  personal: "#4ade80"
};

const LABEL_LABELS: Record<string, string> = {
  top_news: "🔥 Breaking",
  community: "🌊 Trending",
  personal: "🎮 Crew pick"
};

const NEWS_PAGE_SIZE = 8;

function NewsAndFriendsRow({
  generalNews,
  activeMembers,
  totalMemberCount,
  onNavigate
}: {
  generalNews: GeneralNewsItem[];
  activeMembers: GuildMember[];
  totalMemberCount: number;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
        gap: 16,
        alignItems: "start"
      }}
    >
      <GamingNewsFeed news={generalNews} />
      <FriendsOnline
        activeMembers={activeMembers}
        totalMemberCount={totalMemberCount}
        onNavigate={onNavigate}
      />
    </section>
  );
}

function GamingNewsFeed({ news }: { news: GeneralNewsItem[] }) {
  const [tab, setTab] = useState<NewsTab>("all");
  const [showAll, setShowAll] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [activeArticle, setActiveArticle] = useState<GeneralNewsItem | null>(null);

  const filtered = useMemo(() => {
    if (tab === "all") return news;
    return news.filter((item) => item.aiLabel === tab);
  }, [news, tab]);

  const hero = filtered[0] ?? null;
  const rest = filtered.slice(1);
  const visibleRest = showAll ? rest : rest.slice(0, NEWS_PAGE_SIZE - 1);
  const hasMore = rest.length > NEWS_PAGE_SIZE - 1 && !showAll;

  function revealSpoiler(id: string) {
    setRevealedSpoilers((prev) => new Set([...prev, id]));
  }

  return (
    <>
      <section style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 className="island-display" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
              Gaming news
            </h2>
            <div className="island-mono" style={{ marginTop: 4, fontSize: 11, color: islandTheme.color.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Fresh from the shore · AI-curated for the crew
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {NEWS_TABS.map((t) => {
            const active = t.id === tab;
            const count = t.id === "all" ? news.length : news.filter((n) => n.aiLabel === t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setShowAll(false); }}
                style={{
                  border: "none",
                  background: active ? "rgba(37, 99, 235, 0.22)" : "transparent",
                  color: active ? islandTheme.color.textPrimary : islandTheme.color.textSubtle,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  font: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                {t.emoji ? <span>{t.emoji}</span> : null}
                {t.label}
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      background: active ? "rgba(37, 99, 235, 0.35)" : islandTheme.color.panelMutedBg,
                      color: islandTheme.color.textMuted,
                      borderRadius: 999,
                      padding: "1px 6px",
                      fontWeight: 700
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {news.length === 0 ? (
          <NewsEmptyState />
        ) : filtered.length === 0 ? (
          <IslandCard style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 13, color: islandTheme.color.textSubtle }}>
              Nothing in this category right now. Check back after the next curation pass.
            </div>
          </IslandCard>
        ) : (
          <>
            {/* Hero card */}
            {hero && (
              <NewsHeroCard
                item={hero}
                spoilerRevealed={revealedSpoilers.has(hero.externalId)}
                onRevealSpoiler={() => revealSpoiler(hero.externalId)}
                onOpen={() => setActiveArticle(hero)}
              />
            )}

            {/* Supporting grid */}
            {visibleRest.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 10
                }}
              >
                {visibleRest.map((item) => (
                  <NewsCard
                    key={item.externalId}
                    item={item}
                    spoilerRevealed={revealedSpoilers.has(item.externalId)}
                    onRevealSpoiler={() => revealSpoiler(item.externalId)}
                    onOpen={() => setActiveArticle(item)}
                  />
                ))}
              </div>
            )}

            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
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
                {rest.length - (NEWS_PAGE_SIZE - 1)} more stories from the shore →
              </button>
            )}
          </>
        )}
      </section>

      {activeArticle && (
        <NewsArticleModal
          item={activeArticle}
          onClose={() => setActiveArticle(null)}
        />
      )}
    </>
  );
}

function NewsEmptyState() {
  return (
    <IslandCard style={{ padding: "20px 22px" }}>
      <div style={{ display: "grid", gap: 12 }}>
        {/* Skeleton shimmer for 2 placeholder cards */}
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr",
              gap: 12,
              alignItems: "start",
              opacity: 0.4 - i * 0.1
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: islandTheme.color.panelMutedBg,
                animation: "shimmer 1.6s ease-in-out infinite"
              }}
            />
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ height: 13, borderRadius: 6, background: islandTheme.color.panelMutedBg, width: "70%" }} />
              <div style={{ height: 11, borderRadius: 6, background: islandTheme.color.panelMutedBg, width: "90%" }} />
              <div style={{ height: 11, borderRadius: 6, background: islandTheme.color.panelMutedBg, width: "55%" }} />
            </div>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 12, color: islandTheme.color.textMuted, lineHeight: 1.5 }}>
          Curation is running — the tide brings in fresh picks every few minutes. Sync your Steam library to prime the feed.
        </p>
      </div>
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </IslandCard>
  );
}

function NewsHeroCard({
  item,
  spoilerRevealed,
  onRevealSpoiler,
  onOpen
}: {
  item: GeneralNewsItem;
  spoilerRevealed: boolean;
  onRevealSpoiler: () => void;
  onOpen: () => void;
}) {
  const isSpoiler = item.aiSpoilerWarning && !spoilerRevealed;
  const summary = item.aiSummary ?? truncateContents(item.contents, 200);
  const labelColor = LABEL_COLORS[item.aiLabel ?? ""] ?? islandTheme.color.textMuted;
  const labelText = LABEL_LABELS[item.aiLabel ?? ""] ?? null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: item.imageUrl
          ? `linear-gradient(135deg, rgba(8,16,34,0.92) 40%, rgba(8,16,34,0.6) 75%, rgba(8,16,34,0.25) 100%), url("${item.imageUrl}") center / cover no-repeat`
          : `linear-gradient(135deg, rgba(37,99,235,0.28) 0%, ${islandTheme.color.panelBg} 80%)`,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        padding: "24px 24px 20px",
        display: "grid",
        gap: 10,
        transition: "transform 180ms ease, box-shadow 180ms ease",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 20px 45px rgba(0,0,0,0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Top row: source name + label badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {item.sourceName}
        </span>
        {labelText && (
          <span
            className="island-mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: labelColor,
              background: `${labelColor}22`,
              border: `1px solid ${labelColor}44`,
              borderRadius: 999,
              padding: "2px 8px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap"
            }}
          >
            {labelText}
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className="island-display"
        style={{
          margin: 0,
          fontSize: "clamp(17px, 2.5vw, 22px)",
          lineHeight: 1.15,
          color: islandTheme.color.textPrimary
        }}
      >
        {item.title}
      </h3>

      {/* Summary / spoiler */}
      {isSpoiler ? (
        <SpoilerBlock onReveal={(e) => { e.stopPropagation(); onRevealSpoiler(); }} />
      ) : summary ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: islandTheme.color.textSubtle, opacity: 0.95 }}>
          {summary}
        </p>
      ) : null}

      {/* Meta row */}
      <NewsMetaRow item={item} />
    </article>
  );
}

function NewsCard({
  item,
  spoilerRevealed,
  onRevealSpoiler,
  onOpen
}: {
  item: GeneralNewsItem;
  spoilerRevealed: boolean;
  onRevealSpoiler: () => void;
  onOpen: () => void;
}) {
  const isSpoiler = item.aiSpoilerWarning && !spoilerRevealed;
  const summary = item.aiSummary ?? truncateContents(item.contents, 120);
  const labelColor = LABEL_COLORS[item.aiLabel ?? ""] ?? null;
  const labelText = LABEL_LABELS[item.aiLabel ?? ""] ?? null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        background: islandTheme.color.panelBg,
        backdropFilter: islandTheme.glass.blur,
        WebkitBackdropFilter: islandTheme.glass.blur,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        cursor: "pointer",
        transition: "border-color 140ms ease, transform 140ms ease",
        height: "100%",
        boxSizing: "border-box"
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
      {/* Source thumbnail / fallback icon */}
      <div>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: islandTheme.color.panelMutedBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16
            }}
          >
            📰
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
        {labelText && labelColor && (
          <span
            className="island-mono"
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: labelColor,
              textTransform: "uppercase",
              letterSpacing: "0.07em"
            }}
          >
            {labelText}
          </span>
        )}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical"
          }}
        >
          {item.title}
        </div>
        {isSpoiler ? (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onRevealSpoiler(); }}
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 6,
              color: "#f59e0b",
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left"
            }}
          >
            ⚠ Spoiler — tap to reveal
          </button>
        ) : summary ? (
          <div
            style={{
              fontSize: 12,
              color: islandTheme.color.textSubtle,
              lineHeight: 1.45,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical"
            }}
          >
            {summary}
          </div>
        ) : null}
        <NewsMetaRow item={item} compact />
      </div>
    </article>
  );
}

function SpoilerBlock({ onReveal }: { onReveal: (e: React.MouseEvent) => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(245, 158, 11, 0.08)",
        border: "1px solid rgba(245, 158, 11, 0.25)"
      }}
    >
      <span style={{ fontSize: 18 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Spoiler warning</div>
        <div style={{ fontSize: 12, color: islandTheme.color.textMuted, marginTop: 2 }}>
          This article contains story spoilers. Summary hidden.
        </div>
      </div>
      <button
        type="button"
        onClick={onReveal}
        style={{
          background: "rgba(245, 158, 11, 0.15)",
          border: "1px solid rgba(245, 158, 11, 0.35)",
          borderRadius: 8,
          color: "#f59e0b",
          fontSize: 12,
          fontWeight: 700,
          padding: "5px 10px",
          cursor: "pointer",
          font: "inherit",
          whiteSpace: "nowrap"
        }}
      >
        Reveal
      </button>
    </div>
  );
}

function NewsMetaRow({ item, compact = false }: { item: GeneralNewsItem; compact?: boolean }) {
  const ago = relativeAgo(item.publishedAt);
  const crewMatch = item.matchedTags.length > 0;

  return (
    <div
      className="island-mono"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        fontSize: compact ? 10 : 11,
        color: islandTheme.color.textMuted,
        flexWrap: "wrap",
        marginTop: compact ? 2 : 4
      }}
    >
      <span>{ago}</span>
      {!compact && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.sourceName}</span>
        </>
      )}
      {crewMatch && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: "#4ade80" }}>crew match</span>
        </>
      )}
    </div>
  );
}

function truncateContents(contents: string | null, maxChars: number): string | null {
  if (!contents) return null;
  const stripped = contents.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > maxChars ? stripped.slice(0, maxChars) + "…" : stripped;
}

// ── News Article Modal ────────────────────────────────────────────────────────

function NewsArticleModal({
  item,
  onClose
}: {
  item: GeneralNewsItem;
  onClose: () => void;
}) {
  const labelColor = LABEL_COLORS[item.aiLabel ?? ""] ?? islandTheme.color.textMuted;
  const labelText = LABEL_LABELS[item.aiLabel ?? ""] ?? null;
  const fullText = truncateContents(item.contents, 2000);
  const ago = relativeAgo(item.publishedAt);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 0 0"
      }}
    >
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(4, 8, 20, 0.72)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)"
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "20px 20px 0 0",
          background: islandTheme.color.panelBg,
          backdropFilter: islandTheme.glass.blurStrong,
          WebkitBackdropFilter: islandTheme.glass.blurStrong,
          border: `1px solid ${islandTheme.color.cardBorder}`,
          borderBottom: "none",
          padding: "28px 28px 40px"
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close article"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: `1px solid ${islandTheme.color.cardBorder}`,
            background: islandTheme.color.panelMutedBg,
            color: islandTheme.color.textMuted,
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "inherit"
          }}
        >
          ✕
        </button>

        {/* Hero image */}
        {item.imageUrl && (
          <div
            style={{
              marginBottom: 20,
              borderRadius: 12,
              overflow: "hidden",
              maxHeight: 200
            }}
          >
            <img
              src={item.imageUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Source + label row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {item.sourceName}
          </span>
          {item.author && (
            <>
              <span style={{ fontSize: 11, color: islandTheme.color.textMuted, opacity: 0.5 }}>·</span>
              <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>{item.author}</span>
            </>
          )}
          <span style={{ fontSize: 11, color: islandTheme.color.textMuted, opacity: 0.5 }}>·</span>
          <span className="island-mono" style={{ fontSize: 11, color: islandTheme.color.textMuted }}>{ago}</span>
          {labelText && (
            <span
              className="island-mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: labelColor,
                background: `${labelColor}22`,
                border: `1px solid ${labelColor}44`,
                borderRadius: 999,
                padding: "2px 8px",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}
            >
              {labelText}
            </span>
          )}
        </div>

        {/* Headline */}
        <h2
          className="island-display"
          style={{ margin: "0 0 18px", fontSize: "clamp(20px, 3vw, 26px)", lineHeight: 1.15, fontWeight: 800 }}
        >
          {item.title}
        </h2>

        {/* AI summary */}
        {item.aiSummary && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "rgba(37, 99, 235, 0.12)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
              marginBottom: 20
            }}
          >
            <div
              className="island-mono"
              style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: islandTheme.color.primaryGlow, marginBottom: 6 }}
            >
              AI Summary
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: islandTheme.color.textPrimary }}>
              {item.aiSummary}
            </p>
          </div>
        )}

        {/* Why it's relevant */}
        {item.matchedTags.length > 0 && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(74, 222, 128, 0.08)",
              border: "1px solid rgba(74, 222, 128, 0.2)",
              marginBottom: 20
            }}
          >
            <div
              className="island-mono"
              style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ade80", marginBottom: 6 }}
            >
              Why it's relevant to your crew
            </div>
            <p style={{ margin: 0, fontSize: 13, color: islandTheme.color.textSubtle, lineHeight: 1.5 }}>
              Matches crew interests:{" "}
              <span style={{ color: islandTheme.color.textPrimary }}>
                {item.matchedTags.slice(0, 6).join(", ")}
              </span>
            </p>
          </div>
        )}

        {/* Full article text */}
        {fullText && (
          <div style={{ marginBottom: 24 }}>
            <div
              className="island-mono"
              style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: islandTheme.color.textMuted, marginBottom: 10 }}
            >
              Article
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: islandTheme.color.textSubtle }}>
              {fullText}
            </p>
          </div>
        )}

        {/* Source link */}
        <div
          style={{
            paddingTop: 18,
            borderTop: `1px solid ${islandTheme.color.cardBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10
          }}
        >
          <div>
            <div className="island-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: islandTheme.color.textMuted, marginBottom: 2 }}>
              Source
            </div>
            <div style={{ fontSize: 13, color: islandTheme.color.textSubtle }}>{item.sourceName}</div>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 10,
              background: islandTheme.color.primary,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              font: "inherit"
            }}
          >
            Read full article →
          </a>
        </div>
      </div>
    </div>
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

const ACTIVITY_FEED_LIMIT = 5;

function ActivityFeed({ events, onNavigate }: { events: ActivityEvent[]; onNavigate: (page: PageId) => void }) {
  const [tab, setTab] = useState<ActivityCategory>("all");
  const visible = useMemo(
    () => (tab === "all" ? events : events.filter((e) => e.category === tab)),
    [events, tab]
  );
  const sliced = visible.slice(0, ACTIVITY_FEED_LIMIT);
  const hasMore = visible.length > ACTIVITY_FEED_LIMIT;
  return (
    <section id="activity" style={{ display: "grid", gap: 14 }}>
      <SectionHead
        title="Activity feed"
        meta="Latest from your crew — RSVPs, game picks, and library syncs."
        action="Open community →"
        onAction={() => onNavigate("community")}
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
          {sliced.length === 0 ? (
            <div style={{ padding: "24px 14px", fontSize: 13, color: islandTheme.color.textMuted, textAlign: "center" }}>
              {events.length === 0
                ? "No island activity yet — schedule a game night or sync your library to get the dock buzzing."
                : "Nothing in this category right now."}
            </div>
          ) : (
            sliced.map((event, i) => <ActivityRow key={event.id} event={event} firstRow={i === 0} />)
          )}
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => onNavigate("community")}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderTop: `1px solid ${islandTheme.color.cardBorder}`,
              color: islandTheme.color.primaryGlow,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
              font: "inherit"
            }}
          >
            View full feed — {visible.length - ACTIVITY_FEED_LIMIT} more event{visible.length - ACTIVITY_FEED_LIMIT !== 1 ? "s" : ""} →
          </button>
        )}
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
  action,
  onAction
}: {
  title: string;
  meta: string;
  action: string;
  onAction?: () => void;
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
        onClick={(e) => { e.preventDefault(); onAction?.(); }}
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
