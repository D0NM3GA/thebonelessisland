export const islandTheme = {
  color: {
    appBg: "#0f172a",
    panelBg: "#111827",
    panelMutedBg: "#0b1220",
    textPrimary: "#e5e7eb",
    textSecondary: "#e2e8f0",
    textMuted: "#94a3b8",
    textSubtle: "#cbd5e1",
    textInverted: "#f8fafc",
    border: "#334155",
    cardBorder: "#253042",
    primary: "#2563eb",
    primaryText: "#eff6ff",
    primaryStrong: "#3b82f6",
    primaryGlow: "#60a5fa",
    secondary: "#1e293b",
    info: "#1e3a8a",
    infoText: "#dbeafe",
    toolAccent: "#22d3ee",
    danger: "#7f1d1d",
    dangerSurface: "#3f1d1d",
    dangerText: "#fee2e2",
    success: "#14532d",
    successText: "#dcfce7"
  },
  radius: {
    control: 10,
    card: 12,
    surface: 14
  },
  spacing: {
    cardPadding: "0.95rem",
    pagePaddingWide: "1.2rem",
    pagePaddingNarrow: "0.9rem"
  },
  layout: {
    appMaxWidth: 1200,
    authMaxWidth: 900,
    proseMaxWidth: "68ch",
    heroProseMaxWidth: "60ch"
  },
  gradient: {
    gameNightTile: "linear-gradient(160deg, rgba(7,15,35,0.45), rgba(10,18,30,0.8))",
    toolsTile: "linear-gradient(160deg, rgba(7,15,35,0.45), rgba(10,18,30,0.82))",
    comingSoonTile: "linear-gradient(160deg, #0b1220, #0f172a)"
  },
  shadow: {
    tileIdle: "0 4px 14px rgba(2,6,23,0.45)",
    tileComingSoon: "0 4px 14px rgba(2,6,23,0.35)",
    tileGameNightHover: "0 0 0 1px #60a5fa, 0 0 24px rgba(96,165,250,0.55)",
    tileToolsHover: "0 0 0 1px #22d3ee, 0 0 24px rgba(34,211,238,0.55)",
    toast: "0 8px 24px rgba(2, 6, 23, 0.42)"
  }
} as const;

export const islandCopy = {
  labels: {
    steamSynced: "Steam: Synced",
    steamNotSynced: "Steam: Not synced"
  },
  emptyStates: {
    activeMembers: "No island crew in voice right now. Ask an admin to refresh crew sync.",
    noNights: "No game nights docked yet."
  },
  news: {
    placeholderOneTitle: "Placeholder headline #1",
    placeholderOneMeta: "Source: curated feed · tag: co-op",
    placeholderTwoTitle: "Placeholder headline #2",
    placeholderTwoMeta: "Source: curated feed · tag: survival"
  },
  presence: {
    pending: "Presence pending",
    unavailable: "Presence not yet available"
  },
  placeholders: {
    title: "Friday Island Session",
    memberSearch: "Search island members"
  }
} as const;
