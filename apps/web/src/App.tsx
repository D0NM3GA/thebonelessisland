import { useEffect, useMemo, useRef, useState } from "react";
import {
  IslandActiveMemberRow,
  IslandButton,
  IslandCard,
  IslandComingSoonTile,
  IslandGameBlade,
  IslandMemberChip,
  IslandNewsPlaceholderCard,
  IslandStatusPill,
  IslandTileButton,
  islandButtonStyle,
  islandCardStyle,
  islandInputStyle
} from "./islandUi.js";
import { islandCopy, islandTheme } from "./theme.js";

type PageId = "home" | "gameNights" | "bonelessTools" | "profile" | "admin";
type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};
type VoteFlash = {
  appId: number;
  label: string;
  tone: "up" | "neutral" | "down";
};

type Recommendation = {
  appId: number;
  name: string;
  owners: number;
  nearMatchMissingMembers: number;
  score: number;
  reason: string;
};

type GameNight = {
  id: number;
  title: string;
  scheduledFor: string;
  createdByUserId: number;
  topGameName: string | null;
  topGameVote: number | null;
  selectedGameName: string | null;
  selectedAppId: number | null;
  selectedAt: string | null;
  attendeeCount: number;
  currentUserAttending: boolean;
};

type GameNightVote = {
  appId: number;
  name: string;
  totalVote: number;
  currentUserVote: number | null;
};

type GameNightAttendee = {
  discordUserId: string;
  username: string;
};

type AvailableGame = {
  appId: number;
  name: string;
  owners: number;
  voteTotal: number;
  currentUserVote: number | null;
  maxPlayers: number;
  medianSessionMinutes: number;
  developers: string[];
  tags: string[];
  headerImageUrl: string | null;
};
type VoteSortMode = "topVoted" | "mostOwned" | "aToZ";

type GuildMember = {
  discordUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roleNames: string[];
  inVoice: boolean;
  richPresenceText: string | null;
};

type MeProfile = {
  discordUserId: string;
  steamVisibility: "private" | "members" | "public";
  featureOptIn: boolean;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  steamId64: string | null;
  roleNames: string[];
  inVoice: boolean;
  richPresenceText: string;
};

type OwnedGameLite = {
  appId: number;
  name: string;
};

const LOGO_BG_URL = "/boneless-island-logo.png";
const GAME_NIGHTS_TILE_BG_URL = "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/header.jpg";
const BONELESS_TOOLS_TILE_BG_URL =
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg";
const GAME_NIGHT_BANNER_IMAGES = [
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1085660/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/582010/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/236390/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg"
] as const;
const API_BASE_URL = "http://localhost:3000";

function getGameNightBanner(gameNightId: number) {
  return GAME_NIGHT_BANNER_IMAGES[gameNightId % GAME_NIGHT_BANNER_IMAGES.length];
}

function formatGameNightDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getGameImageCandidates(appId: number, headerImageUrl: string | null) {
  const candidates = [
    headerImageUrl ?? "",
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_467x181.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_467x181.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_467x181.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_231x87.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_capsule.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_capsule.jpg`
  ].filter((value) => value.trim().length > 0);
  return Array.from(new Set(candidates));
}

function isLikelyBetaOrPublicTestGame(game: AvailableGame) {
  const name = game.name.toLowerCase();
  const tags = game.tags.map((tag) => tag.toLowerCase());
  const tokens = [name, ...tags].join(" ");
  const keywordPattern = /\b(beta|playtest|public test|test server|technical test|tech test|ptb|ptr)\b/;
  return keywordPattern.test(tokens);
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("Idle");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [profileJson, setProfileJson] = useState("Not loaded");
  const [profileData, setProfileData] = useState<MeProfile | null>(null);
  const [gameNights, setGameNights] = useState<GameNight[]>([]);
  const [newNightTitle, setNewNightTitle] = useState<string>(islandCopy.placeholders.title);
  const [newNightScheduledFor, setNewNightScheduledFor] = useState("");
  const [selectedNightId, setSelectedNightId] = useState<number | null>(null);
  const [voteAppId, setVoteAppId] = useState("");
  const [votingGameAppId, setVotingGameAppId] = useState<number | null>(null);
  const [nightVotes, setNightVotes] = useState<GameNightVote[]>([]);
  const [nightAttendees, setNightAttendees] = useState<GameNightAttendee[]>([]);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [hideBetaAndPublicTests, setHideBetaAndPublicTests] = useState(true);
  const [gameVoteSearch, setGameVoteSearch] = useState("");
  const [voteSortMode, setVoteSortMode] = useState<VoteSortMode>("topVoted");
  const [groupVoteGamesByTag, setGroupVoteGamesByTag] = useState(true);
  const [collapsedVoteGroups, setCollapsedVoteGroups] = useState<Record<string, boolean>>({});
  const [hoveredVoteGameAppId, setHoveredVoteGameAppId] = useState<number | null>(null);
  const [recentVoteFlash, setRecentVoteFlash] = useState<VoteFlash | null>(null);
  const [currentUserAttendingSelectedNight, setCurrentUserAttendingSelectedNight] = useState(false);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isSelectedNightPanelCollapsed, setIsSelectedNightPanelCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoveredHomeTile, setHoveredHomeTile] = useState<"gameNights" | "bonelessTools" | null>(null);
  const [newsKeywords, setNewsKeywords] = useState("co-op, survival, strategy");
  const [newsSources, setNewsSources] = useState("Steam News, PC Gamer, IGN");
  const [profileSteamVisibility, setProfileSteamVisibility] = useState<"private" | "members" | "public">("members");
  const [profileFeatureOptIn, setProfileFeatureOptIn] = useState(true);
  const [ownedGames, setOwnedGames] = useState<OwnedGameLite[]>([]);
  const [ownedGameSearch, setOwnedGameSearch] = useState("");
  const [excludedOwnedGameAppIds, setExcludedOwnedGameAppIds] = useState<number[]>([]);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const nextToastIdRef = useRef(1);
  const toastTimerByIdRef = useRef<Map<number, number>>(new Map());
  const recentVotePulseTimeoutRef = useRef<number | null>(null);

  const filteredGuildMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return guildMembers;
    return guildMembers.filter(
      (member) =>
        member.displayName.toLowerCase().includes(query) ||
        member.username.toLowerCase().includes(query) ||
        member.discordUserId.toLowerCase().includes(query)
    );
  }, [guildMembers, memberSearch]);
  const selectedNight = useMemo(
    () => gameNights.find((night) => night.id === selectedNightId) ?? null,
    [gameNights, selectedNightId]
  );
  const filteredAvailableGames = useMemo(
    () => (hideBetaAndPublicTests ? availableGames.filter((game) => !isLikelyBetaOrPublicTestGame(game)) : availableGames),
    [availableGames, hideBetaAndPublicTests]
  );
  const searchedAvailableGames = useMemo(() => {
    const query = gameVoteSearch.trim().toLowerCase();
    if (!query) return filteredAvailableGames;
    return filteredAvailableGames.filter((game) => {
      const tagText = game.tags.join(" ").toLowerCase();
      return game.name.toLowerCase().includes(query) || tagText.includes(query);
    });
  }, [filteredAvailableGames, gameVoteSearch]);
  const visibleAvailableGames = useMemo(() => {
    return [...searchedAvailableGames].sort((left, right) => {
      if (voteSortMode === "mostOwned") {
        if (right.owners !== left.owners) return right.owners - left.owners;
        return left.name.localeCompare(right.name);
      }
      if (voteSortMode === "aToZ") {
        return left.name.localeCompare(right.name);
      }
      if (right.voteTotal !== left.voteTotal) return right.voteTotal - left.voteTotal;
      return left.name.localeCompare(right.name);
    });
  }, [searchedAvailableGames, voteSortMode]);
  const groupedVoteGames = useMemo(() => {
    if (!groupVoteGamesByTag) {
      return [{ key: "All Games", games: visibleAvailableGames }];
    }

    const groups = new Map<string, AvailableGame[]>();
    for (const game of visibleAvailableGames) {
      const key = game.tags[0]?.trim() || "Other";
      const existing = groups.get(key);
      if (existing) existing.push(game);
      else groups.set(key, [game]);
    }
    return Array.from(groups.entries())
      .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
      .map(([key, games]) => ({ key, games }));
  }, [groupVoteGamesByTag, visibleAvailableGames]);
  const betaOrPublicTestCount = availableGames.length - filteredAvailableGames.length;
  const selectedVoteGame = useMemo(
    () => filteredAvailableGames.find((game) => String(game.appId) === voteAppId) ?? null,
    [filteredAvailableGames, voteAppId]
  );
  const selectedNightBannerUrl = useMemo(
    () => (selectedNight ? getGameNightBanner(selectedNight.id) : GAME_NIGHTS_TILE_BG_URL),
    [selectedNight]
  );
  const filteredOwnedGames = useMemo(() => {
    const query = ownedGameSearch.trim().toLowerCase();
    if (!query) return ownedGames;
    return ownedGames.filter((game) => game.name.toLowerCase().includes(query));
  }, [ownedGames, ownedGameSearch]);
  const hasRecommendations = results.length > 0;
  const hasGameNights = gameNights.length > 0;
  const hasAvailableGames = visibleAvailableGames.length > 0;
  const hasNightAttendees = nightAttendees.length > 0;
  const hasNightVotes = nightVotes.length > 0;
  const isAdmin = Boolean(profileData?.roleNames.includes("Parent"));

  const inputStyle = islandInputStyle;
  const readableProseStyle = { maxWidth: islandTheme.layout.proseMaxWidth, lineHeight: 1.45 };
  const heroProseStyle = { maxWidth: islandTheme.layout.heroProseMaxWidth, lineHeight: 1.45 };

  useEffect(() => {
    try {
      const savedSelectedMemberIds = window.localStorage.getItem("island.selectedMemberIds");
      const savedMemberSearch = window.localStorage.getItem("island.memberSearch");

      if (savedSelectedMemberIds) {
        const parsed = JSON.parse(savedSelectedMemberIds) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed.filter((item): item is string => typeof item === "string");
          setSelectedMemberIds(normalized);
        }
      }
      if (savedMemberSearch !== null) {
        setMemberSearch(savedMemberSearch);
      }
      const savedExcludedIds = window.localStorage.getItem("island.excludedGameAppIds");
      if (savedExcludedIds !== null) {
        const parsed = JSON.parse(savedExcludedIds) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0);
          setExcludedOwnedGameAppIds(normalized);
        }
      }
    } catch {
      // Ignore local storage parse issues.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("island.selectedMemberIds", JSON.stringify(selectedMemberIds));
  }, [selectedMemberIds]);

  useEffect(() => {
    window.localStorage.setItem("island.memberSearch", memberSearch);
  }, [memberSearch]);

  useEffect(() => {
    window.localStorage.setItem("island.excludedGameAppIds", JSON.stringify(excludedOwnedGameAppIds));
  }, [excludedOwnedGameAppIds]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authErrorCode = params.get("authError");
    if (!authErrorCode) {
      return;
    }

    const authErrorMessage =
      authErrorCode === "not_in_guild"
        ? "Access is limited to members of The Boneless Island Discord."
        : authErrorCode === "guild_not_configured"
          ? "Discord guild membership checks are not configured yet."
          : "Discord login failed. Please try again.";
    setAuthError(authErrorMessage);
    params.delete("authError");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const bootstrapAuth = async () => {
      const authed = await loadProfile(true);
      if (isCancelled) return;
      setIsAuthenticated(authed);
      if (authed) {
        await syncGuildMembers(true);
      }
    };

    void bootstrapAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && page === "admin") {
      setPage("home");
    }
  }, [isAdmin, page]);

  useEffect(() => {
    if (!selectedNightId) return;
    const exists = gameNights.some((night) => night.id === selectedNightId);
    if (exists) return;
    setSelectedNightId(null);
    setNightVotes([]);
    setNightAttendees([]);
    setAvailableGames([]);
    setCurrentUserAttendingSelectedNight(false);
  }, [gameNights, selectedNightId]);

  useEffect(() => {
    if (!visibleAvailableGames.length) {
      if (voteAppId !== "") {
        setVoteAppId("");
      }
      return;
    }
    if (!visibleAvailableGames.some((game) => String(game.appId) === voteAppId)) {
      setVoteAppId(String(visibleAvailableGames[0].appId));
    }
  }, [visibleAvailableGames, voteAppId]);

  useEffect(() => {
    if (page !== "gameNights" || !selectedNightId || !visibleAvailableGames.length) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        const isTypingField =
          tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
        if (isTypingField) {
          return;
        }
      }

      const currentIndex = visibleAvailableGames.findIndex((game) => String(game.appId) === voteAppId);
      const resolvedIndex = currentIndex >= 0 ? currentIndex : 0;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex =
          event.key === "ArrowDown"
            ? Math.min(resolvedIndex + 1, visibleAvailableGames.length - 1)
            : Math.max(resolvedIndex - 1, 0);
        setVoteAppId(String(visibleAvailableGames[nextIndex].appId));
        return;
      }

      const selectedGame = visibleAvailableGames[resolvedIndex];
      if (!selectedGame) return;
      if (event.key === "1") {
        event.preventDefault();
        void castVoteForGame(selectedGame.appId, 1, selectedGame.name);
      } else if (event.key === "2") {
        event.preventDefault();
        void castVoteForGame(selectedGame.appId, 0, selectedGame.name);
      } else if (event.key === "3") {
        event.preventDefault();
        void castVoteForGame(selectedGame.appId, -1, selectedGame.name);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [castVoteForGame, page, selectedNightId, visibleAvailableGames, voteAppId]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!status || status === "Idle") return;

    const normalized = status.toLowerCase();
    const isError = normalized.includes("failed") || normalized.includes("error");
    const isSuccess =
      normalized.startsWith("loaded") ||
      normalized.startsWith("synced") ||
      normalized.startsWith("saved") ||
      normalized.startsWith("created") ||
      normalized.startsWith("joined") ||
      normalized.startsWith("left") ||
      normalized.startsWith("finalized") ||
      normalized.startsWith("reopened") ||
      normalized.startsWith("steam sync complete") ||
      normalized.startsWith("logged out") ||
      normalized.startsWith("vote saved");

    if (!isError && !isSuccess) return;

    const id = nextToastIdRef.current++;
    const tone: ToastTone = isError ? "error" : "success";
    setToasts((current) => [...current, { id, message: status, tone }]);
    const timeoutId = window.setTimeout(() => {
      toastTimerByIdRef.current.delete(id);
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
    toastTimerByIdRef.current.set(id, timeoutId);
  }, [status]);

  useEffect(
    () => () => {
      for (const timeoutId of toastTimerByIdRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimerByIdRef.current.clear();
      if (recentVotePulseTimeoutRef.current !== null) {
        window.clearTimeout(recentVotePulseTimeoutRef.current);
        recentVotePulseTimeoutRef.current = null;
      }
    },
    []
  );

  function dismissToast(toastId: number) {
    const timeoutId = toastTimerByIdRef.current.get(toastId);
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      toastTimerByIdRef.current.delete(toastId);
    }
    setToasts((current) => current.filter((item) => item.id !== toastId));
  }

  useEffect(() => {
    if (isAuthenticated !== true) return;

    let syncing = false;
    const runBackgroundSync = async () => {
      if (syncing || document.hidden) return;
      syncing = true;
      try {
        await syncGuildMembers(true);
      } finally {
        syncing = false;
      }
    };

    void runBackgroundSync();
    const intervalId = window.setInterval(() => {
      void runBackgroundSync();
    }, 60000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void runBackgroundSync();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated !== true || page !== "gameNights") return;

    let syncing = false;
    const runNightListSync = async () => {
      if (syncing || document.hidden) return;
      syncing = true;
      try {
        await loadGameNights(true);
      } finally {
        syncing = false;
      }
    };

    void runNightListSync();
    const intervalId = window.setInterval(() => {
      void runNightListSync();
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, page]);

  useEffect(() => {
    if (isAuthenticated !== true || page !== "gameNights" || !selectedNightId) return;

    let syncing = false;
    const runSelectedNightSync = async () => {
      if (syncing || document.hidden) return;
      syncing = true;
      try {
        await loadVotes(selectedNightId, undefined, true);
      } finally {
        syncing = false;
      }
    };

    void runSelectedNightSync();
    const intervalId = window.setInterval(() => {
      void runSelectedNightSync();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, page, selectedNightId]);

  useEffect(() => {
    if (isAuthenticated !== true || !profileData?.steamId64) return;

    let syncing = false;
    const runSteamSync = async () => {
      if (syncing || document.hidden) return;
      syncing = true;
      try {
        await syncSteamGames(true);
      } finally {
        syncing = false;
      }
    };

    void runSteamSync();
    const intervalId = window.setInterval(() => {
      void runSteamSync();
    }, 10 * 60 * 1000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void runSteamSync();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, profileData?.steamId64]);

  async function runRecommendation() {
    if (!selectedMemberIds.length) {
      setStatus("Select one or more members first");
      return;
    }
    setStatus("Loading recommendations...");
    try {
      const response = await fetch("http://localhost:3000/recommendations/what-can-we-play", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedMemberIds,
          sessionLength: "any",
          maxGroupSize: selectedMemberIds.length
        })
      });
      if (!response.ok) {
        throw new Error(`Recommendation request failed (${response.status})`);
      }
      const data = (await response.json()) as { recommendations: Recommendation[] };
      setResults(data.recommendations);
      setStatus(`Loaded ${data.recommendations.length} recommendation(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recommendation request failed");
    }
  }

  async function loadProfile(silent = false) {
    if (!silent) {
      setStatus("Loading profile...");
    }
    try {
      const response = await fetch(`${API_BASE_URL}/profile/me`, { credentials: "include" });
      const data = (await response.json()) as { profile?: MeProfile | null };
      if (response.status === 401 || response.status === 403) {
        setProfileData(null);
        setIsAuthenticated(false);
        if (!silent) {
          setStatus("Session expired. Login with Discord.");
        }
        return false;
      }
      if (!response.ok) {
        throw new Error(`Profile load failed (${response.status})`);
      }
      const profile = data.profile ?? null;
      setProfileData(profile);
      setIsAuthenticated(true);
      if (profile) {
        setProfileSteamVisibility(profile.steamVisibility);
        setProfileFeatureOptIn(profile.featureOptIn);
        if (profile.steamId64) {
          await loadOwnedGames(true);
        } else {
          setOwnedGames([]);
        }
      }
      setProfileJson(JSON.stringify(data, null, 2));
      if (!silent) {
        setStatus("Profile loaded");
      }
      return true;
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Profile load failed");
      }
      return false;
    }
  }

  async function logout() {
    setStatus("Logging out...");
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => undefined);
    setProfileData(null);
    setIsAuthenticated(false);
    setStatus("Logged out. Use Login with Discord.");
  }

  async function saveProfileSettings() {
    setStatus("Saving profile settings...");
    try {
      const response = await fetch("http://localhost:3000/profile/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          steamVisibility: profileSteamVisibility,
          featureOptIn: profileFeatureOptIn
        })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Profile save failed (${response.status})`);
      }
      await loadProfile(true);
      setStatus("Profile settings saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile save failed");
    }
  }

  async function loadOwnedGames(silent = false) {
    if (!silent) {
      setStatus("Loading your owned games...");
    }
    try {
      const response = await fetch("http://localhost:3000/steam/my-games", { credentials: "include" });
      const data = (await response.json().catch(() => null)) as { games?: OwnedGameLite[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Owned games load failed (${response.status})`);
      }
      setOwnedGames(data?.games ?? []);
      if (!silent) {
        setStatus(`Loaded ${data?.games?.length ?? 0} owned game(s)`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Owned games load failed");
      }
    }
  }

  async function syncSteamGames(silent = false) {
    if (!silent) {
      setStatus("Syncing owned Steam games...");
    }
    try {
      const response = await fetch("http://localhost:3000/steam/sync-owned-games", {
        method: "POST",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { syncedGames?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Steam sync failed (${response.status})`);
      }
      await loadOwnedGames(true);
      if (!silent) {
        setStatus(`Steam sync complete (${data?.syncedGames ?? 0} game(s))`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Steam sync failed");
      }
    }
  }

  async function loadGuildMembers(silent = false) {
    if (!silent) {
      setStatus("Loading guild members...");
    }
    try {
      const response = await fetch("http://localhost:3000/members", { credentials: "include" });
      const data = (await response.json().catch(() => null)) as { members?: GuildMember[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Member load failed (${response.status})`);
      }
      setGuildMembers(data?.members ?? []);
      if (!silent) {
        setStatus(`Loaded ${data?.members?.length ?? 0} guild member(s)`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Member load failed");
      }
    }
  }

  async function syncGuildMembers(silent = false) {
    if (!silent) {
      setStatus("Syncing guild members from Discord...");
    }
    try {
      const response = await fetch(`${API_BASE_URL}/members/sync`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as
        | {
            syncedMembers?: number;
            error?: string;
            details?: string;
            voice?: { ok?: boolean; status?: number | null; count?: number; details?: string };
          }
        | null;
      if (!response.ok) {
        throw new Error(data?.details ?? data?.error ?? `Member sync failed (${response.status})`);
      }
      await loadGuildMembers(true);
      await loadProfile(true);
      if (!silent) {
        const voiceInfo = data?.voice;
        const voiceDetails =
          voiceInfo?.ok === false
            ? ` Voice states unavailable (${voiceInfo.status ?? "no status"}). ${voiceInfo.details ?? ""}`.trim()
            : voiceInfo?.ok
              ? ` Voice states: ${voiceInfo.count ?? 0}.`
              : "";
        setStatus(`Synced ${data?.syncedMembers ?? 0} guild member(s).${voiceDetails}`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Member sync failed");
      }
    }
  }

  function toggleSelectedMember(discordUserId: string) {
    const next = new Set(selectedMemberIds);
    if (next.has(discordUserId)) next.delete(discordUserId);
    else next.add(discordUserId);
    setSelectedMemberIds(Array.from(next));
  }

  function selectAllFilteredMembers() {
    const next = new Set(selectedMemberIds);
    for (const member of filteredGuildMembers) {
      next.add(member.discordUserId);
    }
    setSelectedMemberIds(Array.from(next));
  }

  function clearSelectedMembers() {
    setSelectedMemberIds([]);
  }

  function useSelectedNightAttendeesAsSelection() {
    setSelectedMemberIds(nightAttendees.map((attendee) => attendee.discordUserId));
  }

  function toggleExcludedOwnedGame(appId: number) {
    setExcludedOwnedGameAppIds((current) => {
      if (current.includes(appId)) {
        return current.filter((value) => value !== appId);
      }
      return [...current, appId];
    });
  }

  function toggleVoteGroup(groupKey: string) {
    setCollapsedVoteGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  }

  async function loadGameNights(silent = false) {
    if (!silent) {
      setStatus("Loading game nights...");
    }
    try {
      const response = await fetch("http://localhost:3000/game-nights", { credentials: "include" });
      const data = (await response.json().catch(() => null)) as { gameNights?: GameNight[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Game nights request failed (${response.status})`);
      }
      setGameNights(data?.gameNights ?? []);
      if (!silent) {
        setStatus(`Loaded ${data?.gameNights?.length ?? 0} game night(s)`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Game nights request failed");
      }
    }
  }

  async function createGameNight() {
    setStatus("Creating game night...");
    try {
      const iso = newNightScheduledFor ? new Date(newNightScheduledFor).toISOString() : "";
      const response = await fetch("http://localhost:3000/game-nights", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newNightTitle,
          scheduledFor: iso,
          attendeeIds: selectedMemberIds.length ? selectedMemberIds : undefined
        })
      });
      const data = (await response.json().catch(() => null)) as { id?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Create game night failed (${response.status})`);
      }
      await loadGameNights();
      if (data?.id) {
        await loadVotes(data.id);
      }
      setStatus("Created game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create game night failed");
    }
  }

  async function loadVotes(gameNightId: number, nightTitle?: string, silent = false) {
    if (!silent) {
      setStatus(`Loading votes for ${nightTitle ?? "selected game night"}...`);
    }
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${gameNightId}/votes`, {
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as
        | { votes?: Array<GameNightVote & { currentUserVote?: number | null }>; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Vote load failed (${response.status})`);
      }
      setSelectedNightId(gameNightId);
      setNightVotes(
        (data?.votes ?? []).map((row) => ({
          appId: row.appId,
          name: row.name,
          totalVote: row.totalVote,
          currentUserVote: row.currentUserVote ?? null
        }))
      );
      await loadAttendees(gameNightId);
      await loadAvailableGames(gameNightId);
      if (!silent) {
        setStatus(`Loaded ${data?.votes?.length ?? 0} vote row(s)`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Vote load failed");
      }
    }
  }

  async function loadAvailableGames(gameNightId: number) {
    const response = await fetch(`http://localhost:3000/game-nights/${gameNightId}/available-games`, {
      credentials: "include"
    });
    const data = (await response.json().catch(() => null)) as
      | { games?: Array<AvailableGame & { currentUserVote?: number | null }>; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(data?.error ?? `Available game load failed (${response.status})`);
    }
    const games = (data?.games ?? []).map((game) => ({
      ...game,
      currentUserVote: game.currentUserVote ?? null
    }));
    setAvailableGames(games);
  }

  async function loadAttendees(gameNightId: number) {
    const response = await fetch(`http://localhost:3000/game-nights/${gameNightId}/attendees`, {
      credentials: "include"
    });
    const data = (await response.json().catch(() => null)) as
      | { attendees?: GameNightAttendee[]; currentUserIsAttending?: boolean; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(data?.error ?? `Attendee load failed (${response.status})`);
    }
    setNightAttendees(data?.attendees ?? []);
    setCurrentUserAttendingSelectedNight(Boolean(data?.currentUserIsAttending));
  }

  async function joinSelectedNight() {
    if (!selectedNightId) return setStatus("Pick a game night first");
    setStatus("Joining game night...");
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees/me`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Join failed (${response.status})`);
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Joined game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Join failed");
    }
  }

  async function leaveSelectedNight() {
    if (!selectedNightId) return setStatus("Pick a game night first");
    setStatus("Leaving game night...");
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees/me`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Leave failed (${response.status})`);
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Left game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Leave failed");
    }
  }

  async function addSelectedMembersToNight() {
    if (!selectedNightId) return setStatus("Pick a game night first");
    if (!selectedMemberIds.length) return setStatus("Pick at least one member first");

    setStatus(`Adding ${selectedMemberIds.length} member(s) to selected game night...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberIds: selectedMemberIds })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Add attendees failed (${response.status})`);
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Added selected members to night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Add attendees failed");
    }
  }

  async function removeSelectedMembersFromNight() {
    if (!selectedNightId) return setStatus("Pick a game night first");
    if (!selectedMemberIds.length) return setStatus("Pick at least one member first");

    setStatus(`Removing ${selectedMemberIds.length} member(s) from selected game night...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberIds: selectedMemberIds })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Remove attendees failed (${response.status})`);
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Removed selected members from night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Remove attendees failed");
    }
  }

  async function castVoteForGame(appId: number, vote: -1 | 0 | 1, gameName: string) {
    if (!selectedNightId) return setStatus("Pick a game night first");
    if (!Number.isInteger(appId) || appId <= 0) return setStatus("Select a game first");

    setVoteAppId(String(appId));
    setVotingGameAppId(appId);
    const previousAvailableGames = availableGames;
    const previousNightVotes = nightVotes;
    const previousVote = availableGames.find((game) => game.appId === appId)?.currentUserVote ?? 0;
    const delta = vote - previousVote;
    const normalizedVote = vote;
    setAvailableGames((current) =>
      current.map((game) =>
        game.appId === appId
          ? { ...game, voteTotal: game.voteTotal + delta, currentUserVote: normalizedVote }
          : game
      )
    );
    setNightVotes((current) => {
      const existing = current.find((row) => row.appId === appId);
      if (existing) {
        return current.map((row) =>
          row.appId === appId
            ? { ...row, totalVote: row.totalVote + delta, currentUserVote: normalizedVote }
            : row
        );
      }
      const shouldAddRow = delta !== 0 || normalizedVote !== 0;
      if (!shouldAddRow) {
        return current;
      }
      return [...current, { appId, name: gameName, totalVote: delta, currentUserVote: normalizedVote }].sort(
        (left, right) => right.totalVote - left.totalVote || left.name.localeCompare(right.name)
      );
    });
    setStatus("Saving vote...");
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/votes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId, vote })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Vote save failed (${response.status})`);
      await loadVotes(selectedNightId, undefined, true);
      const flash: VoteFlash =
        vote === 1
          ? { appId, label: "+1 Hype", tone: "up" }
          : vote === 0
            ? { appId, label: "0 Maybe", tone: "neutral" }
            : { appId, label: "-1 Skip", tone: "down" };
      setRecentVoteFlash(flash);
      if (recentVotePulseTimeoutRef.current !== null) {
        window.clearTimeout(recentVotePulseTimeoutRef.current);
      }
      recentVotePulseTimeoutRef.current = window.setTimeout(() => {
        setRecentVoteFlash((current) => (current?.appId === appId ? null : current));
        recentVotePulseTimeoutRef.current = null;
      }, 900);
      setStatus(`Vote saved: ${gameName}`);
    } catch (error) {
      setAvailableGames(previousAvailableGames);
      setNightVotes(previousNightVotes);
      setStatus(error instanceof Error ? error.message : "Vote save failed");
    } finally {
      setVotingGameAppId((current) => (current === appId ? null : current));
    }
  }

  async function finalizeSelectedNight(appIdOverride?: number) {
    if (!selectedNightId) return setStatus("Pick a game night first");

    setStatus("Finalizing selected game night...");
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/finalize`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId: appIdOverride })
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; selectedAppId?: number; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error ?? `Finalize failed (${response.status})`);
      await loadGameNights();
      setStatus("Finalized pick for selected game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Finalize failed");
    }
  }

  async function unfinalizeSelectedNight() {
    if (!selectedNightId) return setStatus("Pick a game night first");
    setStatus("Reopening selected game night...");
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/finalize`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Reopen failed (${response.status})`);
      await loadGameNights();
      setStatus("Reopened selected game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reopen failed");
    }
  }

  async function recommendForSelectedNight() {
    if (!selectedNightId) return setStatus("Pick a game night first");

    setStatus("Loading recommendations for selected game night...");
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/recommendations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedMemberIds.length ? selectedMemberIds : undefined,
          sessionLength: "any"
        })
      });
      const data = (await response.json().catch(() => null)) as
        | { recommendations?: Recommendation[]; memberIds?: string[]; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error ?? `Recommendation request failed (${response.status})`);
      setResults(data?.recommendations ?? []);
      setStatus(`Loaded ${data?.recommendations?.length ?? 0} recommendation(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recommendation request failed");
    }
  }

  const activeMembers = guildMembers.filter((member) => member.inVoice || member.richPresenceText !== null);

  function saveNewsControlsPlaceholder() {
    setStatus("Saved placeholder news curation settings (UI only for now)");
  }

  if (isAuthenticated !== true) {
    const pageTitle = isAuthenticated === null ? "Checking session..." : "Welcome to The Boneless Island";
    const pageBody =
      isAuthenticated === null
        ? "Hang tight while we check your Discord session."
        : "Sign in with Discord to access the community tools and game night planner.";
    return (
      <main
        style={{
          fontFamily: "Inter, Segoe UI, sans-serif",
          maxWidth: islandTheme.layout.authMaxWidth,
          margin: "2rem auto",
          color: islandTheme.color.textPrimary,
          backgroundColor: islandTheme.color.appBg,
          padding: islandTheme.spacing.pagePaddingWide,
          borderRadius: islandTheme.radius.surface
        }}
      >
        <section
          style={{
            background: islandTheme.color.panelBg,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            borderRadius: islandTheme.radius.card,
            padding: islandTheme.spacing.pagePaddingWide
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 10 }}>{pageTitle}</h1>
          <p style={{ marginTop: 0, opacity: 0.95, ...readableProseStyle }}>{pageBody}</p>
          {authError ? (
            <p
              style={{
                border: `1px solid ${islandTheme.color.danger}`,
                background: islandTheme.color.dangerSurface,
                color: islandTheme.color.dangerText,
                borderRadius: islandTheme.radius.control,
                padding: "0.65rem 0.7rem"
              }}
            >
              {authError}
            </p>
          ) : null}
          {isAuthenticated === false ? (
            <a
              href={`${API_BASE_URL}/auth/discord/login`}
              style={{
                display: "inline-block",
                marginTop: 4,
                borderRadius: islandTheme.radius.control,
                border: `1px solid ${islandTheme.color.primary}`,
                background: islandTheme.color.primary,
                color: islandTheme.color.primaryText,
                padding: "0.55rem 0.9rem",
                textDecoration: "none",
                fontWeight: 600
              }}
            >
              Login with Discord
            </a>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        fontFamily: "Inter, Segoe UI, sans-serif",
        maxWidth: islandTheme.layout.appMaxWidth,
        margin: "1.25rem auto",
        color: islandTheme.color.textPrimary,
        backgroundColor: islandTheme.color.appBg,
        padding: "clamp(0.9rem, 2vw, 1.2rem)",
        borderRadius: islandTheme.radius.surface
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <IslandButton variant={page === "home" ? "primary" : "secondary"} onClick={() => setPage("home")}>
            Home
          </IslandButton>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {isAdmin ? (
            <IslandButton variant={page === "admin" ? "primary" : "secondary"} onClick={() => setPage("admin")}>
              Admin
            </IslandButton>
          ) : null}
          <div ref={userMenuRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              onClick={() => setIsUserMenuOpen((open) => !open)}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 0,
                border: "none",
                background: "transparent",
                color: "inherit"
              }}
            >
              {profileData?.avatarUrl ? (
                <img
                  src={profileData.avatarUrl}
                  alt={profileData.displayName}
                  style={{ width: 34, height: 34, borderRadius: "999px", border: `1px solid ${islandTheme.color.border}` }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "999px",
                    border: `1px solid ${islandTheme.color.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: islandTheme.color.secondary,
                    fontSize: 12
                  }}
                >
                  ?
                </div>
              )}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{profileData?.displayName ?? "Not signed in"}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  {profileData?.richPresenceText ?? islandCopy.presence.pending}
                </div>
              </div>
            </button>
            <IslandStatusPill tone={profileData?.steamId64 ? "success" : "danger"}>
              {profileData?.steamId64 ? islandCopy.labels.steamSynced : islandCopy.labels.steamNotSynced}
            </IslandStatusPill>
            {isUserMenuOpen ? (
              <div
              style={{
                marginTop: 2,
                minWidth: 220,
                background: islandTheme.color.panelBg,
                border: `1px solid ${islandTheme.color.border}`,
                borderRadius: islandTheme.radius.control,
                padding: "0.55rem",
                position: "absolute",
                top: "100%",
                right: 0,
                zIndex: 20
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
                Roles: {profileData?.roleNames.length ? profileData.roleNames.join(", ") : "No synced roles"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <IslandButton
                  variant="secondary"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setPage("profile");
                  }}
                  style={{ marginRight: 0 }}
                >
                  Profile Settings
                </IslandButton>
                <IslandButton
                  variant="danger"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void logout();
                  }}
                  style={{ marginRight: 0 }}
                >
                  Logout
                </IslandButton>
              </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {page === "home" ? (
        <>
          <section
            style={{
              ...islandCardStyle,
              position: "relative",
              overflow: "hidden",
              minHeight: 220
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url("${LOGO_BG_URL}")`,
                backgroundPosition: "right center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "clamp(240px, 33vw, 420px)",
                opacity: 0.16,
                pointerEvents: "none"
              }}
            />
            <div style={{ position: "relative", zIndex: 1, maxWidth: islandTheme.layout.heroProseMaxWidth }}>
              <h1 style={{ marginTop: 0, fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>Welcome to the Island</h1>
              <p style={{ fontSize: 16, opacity: 0.95, ...heroProseStyle }}>
                Welcome to The Boneless Island hub. Crew activity and Steam libraries sync automatically in the
                background so you can jump straight into planning nights.
              </p>
            </div>
          </section>

          <IslandCard style={{ marginTop: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: 14,
                alignItems: "stretch"
              }}
            >
              <IslandTileButton
                title="Game Nights"
                description="Create nights, vote on common-owned games, and finalize your pick."
                imageUrl={GAME_NIGHTS_TILE_BG_URL}
                accent="primary"
                hovered={hoveredHomeTile === "gameNights"}
                onClick={() => setPage("gameNights")}
                onMouseEnter={() => setHoveredHomeTile("gameNights")}
                onMouseLeave={() => setHoveredHomeTile(null)}
              />

              <IslandTileButton
                title="Boneless Tools"
                description="Placeholder for planning tools like wishlist overlap and buy planning."
                imageUrl={BONELESS_TOOLS_TILE_BG_URL}
                accent="tool"
                hovered={hoveredHomeTile === "bonelessTools"}
                onClick={() => setPage("bonelessTools")}
                onMouseEnter={() => setHoveredHomeTile("bonelessTools")}
                onMouseLeave={() => setHoveredHomeTile(null)}
              />

              <IslandComingSoonTile />
            </div>
          </IslandCard>

          <IslandCard style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>News</h3>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Future AI-curated gaming news will live here, filtered by keywords, genres, titles, or community tags.
              Admins will control what appears through the Admin page curation controls.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <IslandNewsPlaceholderCard title={islandCopy.news.placeholderOneTitle} meta={islandCopy.news.placeholderOneMeta} />
              <IslandNewsPlaceholderCard title={islandCopy.news.placeholderTwoTitle} meta={islandCopy.news.placeholderTwoMeta} />
            </div>
          </IslandCard>

          <IslandCard style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Who's active in Discord right now</h3>
            </div>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Rich presence is prepared. For now this uses synced voice/presence snapshots from Discord API data.
            </p>
            <p style={{ marginTop: 0, fontSize: 12, opacity: 0.82 }}>Auto-updates every minute while you're online.</p>
            {activeMembers.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {activeMembers.map((member) => (
                  <IslandActiveMemberRow
                    key={member.discordUserId}
                    displayName={member.displayName}
                    avatarUrl={member.avatarUrl}
                    presenceText={member.richPresenceText ?? islandCopy.presence.unavailable}
                    inVoice={member.inVoice}
                  />
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.88 }}>{islandCopy.emptyStates.activeMembers}</p>
            )}
          </IslandCard>
        </>
      ) : null}

      {page === "gameNights" ? (
        <>
          <IslandCard>
            <div
              style={{
                position: "relative",
                borderRadius: islandTheme.radius.card,
                overflow: "hidden",
                minHeight: 230,
                border: `1px solid ${islandTheme.color.border}`
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `linear-gradient(140deg, rgba(5,12,28,0.25), rgba(5,12,28,0.92)), url("${selectedNightBannerUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  minHeight: "100%",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: "clamp(1.6rem, 3.3vw, 2.1rem)" }}>
                    Game Night Dock
                  </h2>
                  <p style={{ marginTop: 0, opacity: 0.96, ...heroProseStyle }}>
                    Plan a night in minutes: pick your crew, set the time, then vote on games everyone already owns.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <IslandStatusPill tone="success">Nights live: {gameNights.length}</IslandStatusPill>
                  <IslandStatusPill tone={selectedNight ? "success" : "danger"}>
                    Lobby: {selectedNight ? selectedNight.title : "none selected"}
                  </IslandStatusPill>
                </div>
                <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, opacity: 0.85 }}>
                  Live sync is on: crew every 60s, night list every 20s, selected lobby every 15s.
                </p>
              </div>
            </div>
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>1) Pick your island crew</h3>
                <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.9 }}>
                  Selected crew: <strong>{selectedMemberIds.length}</strong>
                </p>
              </div>
              <IslandButton
                variant="secondary"
                onClick={() => setIsSelectedNightPanelCollapsed((value) => !value)}
                style={{ marginRight: 0 }}
              >
                {isSelectedNightPanelCollapsed ? "Show crew selector" : "Hide crew selector"}
              </IslandButton>
            </div>

            {!isSelectedNightPanelCollapsed ? (
              <>
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    placeholder={islandCopy.placeholders.memberSearch}
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 240 }}
                  />
                  <IslandButton variant="secondary" onClick={selectAllFilteredMembers} style={{ marginRight: 0 }}>
                    Select filtered
                  </IslandButton>
                  <IslandButton variant="secondary" onClick={clearSelectedMembers} style={{ marginRight: 0 }}>
                    Clear
                  </IslandButton>
                  <IslandButton variant="secondary" onClick={useSelectedNightAttendeesAsSelection} style={{ marginRight: 0 }}>
                    Use current attendees
                  </IslandButton>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    maxHeight: 190,
                    overflowY: "auto",
                    border: `1px solid ${islandTheme.color.border}`,
                    borderRadius: islandTheme.radius.control,
                    padding: "0.55rem",
                    background: islandTheme.color.panelMutedBg
                  }}
                >
                  {filteredGuildMembers.map((member) => {
                    const selected = selectedMemberIds.includes(member.discordUserId);
                    return (
                      <IslandMemberChip
                        key={member.discordUserId}
                        onClick={() => toggleSelectedMember(member.discordUserId)}
                        selected={selected}
                        label={member.displayName}
                      />
                    );
                  })}
                </div>
              </>
            ) : null}
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>2) Drop a new game night</h3>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Start with a title and time. Your selected crew gets added automatically when the lobby is created.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="Friday sunset co-op session"
                value={newNightTitle}
                onChange={(e) => setNewNightTitle(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              />
              <input
                type="datetime-local"
                value={newNightScheduledFor}
                onChange={(e) => setNewNightScheduledFor(e.target.value)}
                style={{ ...inputStyle, minWidth: 220 }}
              />
              <IslandButton variant="primary" onClick={createGameNight} style={{ marginRight: 0 }}>
                Create lobby
              </IslandButton>
            </div>
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>3) Open a lobby</h3>
            {hasGameNights ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
                  gap: 10
                }}
              >
                {gameNights.map((night) => (
                  <button
                    key={night.id}
                    onClick={() => void loadVotes(night.id, night.title)}
                    style={{
                      ...islandButtonStyle("secondary"),
                      textAlign: "left",
                      padding: 0,
                      overflow: "hidden",
                      border: selectedNightId === night.id ? `1px solid ${islandTheme.color.primaryGlow}` : `1px solid ${islandTheme.color.border}`,
                      boxShadow: selectedNightId === night.id ? islandTheme.shadow.tileGameNightHover : islandTheme.shadow.tileIdle
                    }}
                  >
                    <div
                      style={{
                        minHeight: 122,
                        padding: "0.7rem",
                        backgroundImage: `linear-gradient(160deg, rgba(10,18,35,0.2), rgba(10,18,35,0.86)), url("${getGameNightBanner(night.id)}")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center"
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{night.title}</div>
                      <div style={{ opacity: 0.95 }}>{formatGameNightDate(night.scheduledFor)}</div>
                    </div>
                    <div style={{ padding: "0.7rem" }}>
                      <div style={{ fontSize: 13, opacity: 0.95 }}>Crew: {night.attendeeCount}</div>
                      <div style={{ fontSize: 13, opacity: 0.95 }}>
                        {night.selectedGameName
                          ? `Final pick: ${night.selectedGameName}`
                          : night.topGameName
                            ? `Top vote: ${night.topGameName}`
                            : "No votes yet"}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <IslandStatusPill tone={night.currentUserAttending ? "success" : "danger"}>
                          {night.currentUserAttending ? "You're in" : "Not joined"}
                        </IslandStatusPill>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.9 }}>{islandCopy.emptyStates.noNights}</p>
            )}
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0 }}>
              Night lobby: {selectedNight ? `${selectedNight.title}` : "pick a night card above"}
            </h3>
            {!selectedNight ? (
              <p style={{ opacity: 0.9 }}>Pick a game night card to reveal attendees, voting, and final pick controls.</p>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 10,
                    borderRadius: islandTheme.radius.control,
                    border: `1px solid ${islandTheme.color.border}`,
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      minHeight: 136,
                      padding: "0.85rem",
                      backgroundImage: `linear-gradient(165deg, rgba(9,16,32,0.2), rgba(9,16,32,0.9)), url("${selectedNightBannerUrl}")`,
                      backgroundPosition: "center",
                      backgroundSize: "cover"
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{selectedNight.title}</div>
                    <div style={{ marginTop: 4, opacity: 0.95 }}>{formatGameNightDate(selectedNight.scheduledFor)}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <IslandStatusPill tone={selectedNight.selectedGameName ? "success" : "danger"}>
                        {selectedNight.selectedGameName ? `Final: ${selectedNight.selectedGameName}` : "Not finalized"}
                      </IslandStatusPill>
                      <IslandStatusPill tone={selectedNight.topGameName ? "success" : "danger"}>
                        {selectedNight.topGameName ? `Top vote: ${selectedNight.topGameName}` : "No top vote yet"}
                      </IslandStatusPill>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <IslandButton
                    variant={currentUserAttendingSelectedNight ? "danger" : "secondary"}
                    onClick={currentUserAttendingSelectedNight ? leaveSelectedNight : joinSelectedNight}
                    style={{ marginRight: 0 }}
                  >
                    {currentUserAttendingSelectedNight ? "Leave this night" : "Join this night"}
                  </IslandButton>
                  <IslandButton variant="secondary" onClick={addSelectedMembersToNight} style={{ marginRight: 0 }}>
                    Add selected crew
                  </IslandButton>
                  <IslandButton variant="secondary" onClick={removeSelectedMembersFromNight} style={{ marginRight: 0 }}>
                    Remove selected crew
                  </IslandButton>
                  <IslandButton variant="primary" onClick={recommendForSelectedNight} style={{ marginRight: 0 }}>
                    Recommend picks
                  </IslandButton>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ marginBottom: 6, fontWeight: 700 }}>Vote on common games</div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={hideBetaAndPublicTests}
                      onChange={(event) => setHideBetaAndPublicTests(event.target.checked)}
                    />
                    Hide betas and public test builds
                  </label>
                  {hideBetaAndPublicTests && betaOrPublicTestCount > 0 ? (
                    <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, opacity: 0.82 }}>
                      Filtered out {betaOrPublicTestCount} beta/public test title(s).
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <input
                      value={gameVoteSearch}
                      onChange={(event) => setGameVoteSearch(event.target.value)}
                      placeholder="Search the game dock"
                      style={{ ...inputStyle, minWidth: 220, flex: 1 }}
                    />
                    <span style={{ fontSize: 12, opacity: 0.86 }}>
                      Showing {visibleAvailableGames.length} of {filteredAvailableGames.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <IslandButton
                      variant={voteSortMode === "topVoted" ? "primary" : "secondary"}
                      onClick={() => setVoteSortMode("topVoted")}
                      style={{ marginRight: 0 }}
                    >
                      Top voted
                    </IslandButton>
                    <IslandButton
                      variant={voteSortMode === "mostOwned" ? "primary" : "secondary"}
                      onClick={() => setVoteSortMode("mostOwned")}
                      style={{ marginRight: 0 }}
                    >
                      Most owned
                    </IslandButton>
                    <IslandButton
                      variant={voteSortMode === "aToZ" ? "primary" : "secondary"}
                      onClick={() => setVoteSortMode("aToZ")}
                      style={{ marginRight: 0 }}
                    >
                      A-Z
                    </IslandButton>
                    <IslandButton
                      variant={groupVoteGamesByTag ? "primary" : "secondary"}
                      onClick={() => setGroupVoteGamesByTag((value) => !value)}
                      style={{ marginRight: 0 }}
                    >
                      {groupVoteGamesByTag ? "Grouped by tag" : "Single list"}
                    </IslandButton>
                  </div>
                  <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
                    Keyboard: ↑/↓ to move selection, 1 = Hype, 2 = Maybe, 3 = Skip.
                  </p>
                  {hasAvailableGames ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        maxHeight: 360,
                        overflowY: "auto",
                        border: `1px solid ${islandTheme.color.border}`,
                        borderRadius: islandTheme.radius.control,
                        padding: "0.55rem",
                        background: islandTheme.color.panelMutedBg
                      }}
                    >
                      {groupedVoteGames.map((group) => (
                        <div key={group.key} style={{ display: "grid", gap: 6 }}>
                          {groupVoteGamesByTag ? (
                            <button
                              type="button"
                              onClick={() => toggleVoteGroup(group.key)}
                              style={{
                                ...islandButtonStyle("secondary"),
                                textAlign: "left",
                                marginRight: 0,
                                fontSize: 12,
                                padding: "0.35rem 0.5rem"
                              }}
                            >
                              {collapsedVoteGroups[group.key] ? "▶" : "▼"} {group.key} ({group.games.length})
                            </button>
                          ) : null}
                          {!collapsedVoteGroups[group.key]
                            ? group.games.map((game) => {
                                const selected = String(game.appId) === voteAppId;
                                return (
                                  <IslandGameBlade
                                    key={game.appId}
                                    onSelect={() => setVoteAppId(String(game.appId))}
                                    onVote={(vote) => void castVoteForGame(game.appId, vote, game.name)}
                                    selected={selected}
                                    currentUserVote={game.currentUserVote}
                                    hovered={hoveredVoteGameAppId === game.appId}
                                    isVoting={votingGameAppId === game.appId}
                                    justVoted={recentVoteFlash?.appId === game.appId}
                                    voteFlashLabel={recentVoteFlash?.appId === game.appId ? recentVoteFlash.label : undefined}
                                    voteFlashTone={recentVoteFlash?.appId === game.appId ? recentVoteFlash.tone : undefined}
                                    onMouseEnter={() => setHoveredVoteGameAppId(game.appId)}
                                    onMouseLeave={() =>
                                      setHoveredVoteGameAppId((current) => (current === game.appId ? null : current))
                                    }
                                    title={game.name}
                                    subtitle={`owners ${game.owners} | votes ${game.voteTotal}`}
                                    meta={`${game.maxPlayers} players • ${game.medianSessionMinutes}m median`}
                                    tags={game.tags.slice(0, 3)}
                                    imageUrl={game.headerImageUrl}
                                    imageFallbackUrls={getGameImageCandidates(game.appId, game.headerImageUrl)}
                                  />
                                );
                              })
                            : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ opacity: 0.9 }}>
                      {hideBetaAndPublicTests && betaOrPublicTestCount > 0
                        ? "Only beta/public test titles are available right now. Turn off the filter to include them."
                        : gameVoteSearch.trim()
                          ? "No games match this search yet."
                          : "No shared games yet. Ask attendees to sync Steam so we can surface titles everyone owns."}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <select value={voteAppId} onChange={(e) => setVoteAppId(e.target.value)} style={inputStyle}>
                    <option value="">Select available game</option>
                    {visibleAvailableGames.map((game) => (
                      <option key={game.appId} value={String(game.appId)}>
                        {game.name} (votes {game.voteTotal})
                      </option>
                    ))}
                  </select>
                  <IslandButton
                    variant="primary"
                    onClick={() => void finalizeSelectedNight(selectedVoteGame?.appId)}
                    style={{ marginRight: 0 }}
                  >
                    Finalize selected game
                  </IslandButton>
                  <IslandButton variant="danger" onClick={unfinalizeSelectedNight} style={{ marginRight: 0 }}>
                    Reopen voting
                  </IslandButton>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                  <IslandCard as="div" style={{ padding: "0.65rem" }}>
                    <strong>Attendees ({nightAttendees.length})</strong>
                    {hasNightAttendees ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {nightAttendees.map((row) => (
                          <IslandMemberChip
                            key={row.discordUserId}
                            onClick={() => toggleSelectedMember(row.discordUserId)}
                            selected={selectedMemberIds.includes(row.discordUserId)}
                            label={row.username}
                          />
                        ))}
                      </div>
                    ) : (
                      <p style={{ opacity: 0.9 }}>No attendees loaded yet.</p>
                    )}
                  </IslandCard>
                  <IslandCard as="div" style={{ padding: "0.65rem" }}>
                    <strong>Vote totals</strong>
                    {hasNightVotes ? (
                      <ul style={{ marginBottom: 0 }}>
                        {nightVotes.map((row) => (
                          <li key={row.appId}>
                            {row.name}: {row.totalVote}
                            {row.currentUserVote !== null ? ` (you: ${row.currentUserVote > 0 ? "+" : ""}${row.currentUserVote})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ opacity: 0.9, marginBottom: 0 }}>No votes yet.</p>
                    )}
                  </IslandCard>
                </div>
              </>
            )}
          </IslandCard>

          <IslandCard as="div" style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Quick host actions</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <IslandButton variant="secondary" onClick={joinSelectedNight} style={{ marginRight: 0 }}>
                Join selected lobby
              </IslandButton>
              <IslandButton variant="secondary" onClick={leaveSelectedNight} style={{ marginRight: 0 }}>
                Leave selected lobby
              </IslandButton>
              <IslandButton variant="secondary" onClick={addSelectedMembersToNight} style={{ marginRight: 0 }}>
                Add selected crew
              </IslandButton>
              <IslandButton variant="secondary" onClick={removeSelectedMembersFromNight} style={{ marginRight: 0 }}>
                Remove selected crew
              </IslandButton>
              <IslandButton variant="primary" onClick={() => void finalizeSelectedNight()} style={{ marginRight: 0 }}>
                Finalize top vote
              </IslandButton>
            </div>
          </IslandCard>
        </>
      ) : null}

      {page === "bonelessTools" ? (
        <IslandCard style={{ marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>Boneless Tools</h2>
          <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
            Placeholder page for community planning tools.
          </p>
          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Wishlist Planning (Coming next)</h3>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Goal: let members share wishlisted games, see overlap, and plan group purchases around discounts or events.
            </p>
          </IslandCard>
          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Future Tool Slots</h3>
            <ul style={{ marginBottom: 0 }}>
              <li>Event budget and buy planning</li>
              <li>Genre interest mapping</li>
              <li>Weekly community poll helpers</li>
            </ul>
          </IslandCard>
        </IslandCard>
      ) : null}

      {page === "profile" ? (
        <IslandCard style={{ marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>User Profile Settings</h2>
          <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
            Manage your personal account preferences and privacy options.
          </p>

          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Account</h3>
            <p style={{ marginTop: 0, marginBottom: 4 }}>
              <strong>Display Name:</strong> {profileData?.displayName ?? "Not signed in"}
            </p>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              <strong>Discord Username:</strong> @{profileData?.username ?? "unknown"}
            </p>
          </IslandCard>

          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Privacy & Library Preferences</h3>
            <p style={{ marginTop: 0, marginBottom: 8 }}>Steam library visibility</p>
            <select
              value={profileSteamVisibility}
              onChange={(event) =>
                setProfileSteamVisibility(event.target.value as "private" | "members" | "public")
              }
              style={{ ...inputStyle, width: "100%" }}
            >
              <option value="private">Private (only you)</option>
              <option value="members">Members only</option>
              <option value="public">Public</option>
            </select>

            <p style={{ marginTop: 12, marginBottom: 8 }}>Exclude owned games from public visibility</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={ownedGameSearch}
                onChange={(event) => setOwnedGameSearch(event.target.value)}
                placeholder="Search your owned games"
                style={{ ...inputStyle, flex: 1, minWidth: 240 }}
              />
            </div>
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, opacity: 0.82 }}>
              Library visibility and game list update automatically while you're online.
            </p>
            {profileData?.steamId64 ? (
              <div
                style={{
                  marginTop: 8,
                  border: `1px solid ${islandTheme.color.border}`,
                  borderRadius: islandTheme.radius.control,
                  padding: "0.55rem",
                  maxHeight: 220,
                  overflowY: "auto",
                  background: islandTheme.color.panelMutedBg
                }}
              >
                {filteredOwnedGames.length ? (
                  filteredOwnedGames.slice(0, 120).map((game) => (
                    <label
                      key={game.appId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0.24rem 0"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={excludedOwnedGameAppIds.includes(game.appId)}
                        onChange={() => toggleExcludedOwnedGame(game.appId)}
                      />
                      <span>{game.name}</span>
                    </label>
                  ))
                ) : (
                  <p style={{ margin: 0, opacity: 0.85 }}>No matching games yet. Steam updates automatically while online.</p>
                )}
              </div>
            ) : (
              <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.85 }}>
                Link and sync Steam first to choose games from your library.
              </p>
            )}
            <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, opacity: 0.8 }}>
              Selected exclusions: {excludedOwnedGameAppIds.length}
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <input
                type="checkbox"
                checked={profileFeatureOptIn}
                onChange={(event) => setProfileFeatureOptIn(event.target.checked)}
              />
              Participate in optional feature previews
            </label>

            <p style={{ marginBottom: 0 }}>
              <IslandButton variant="primary" onClick={saveProfileSettings} style={{ marginTop: 10 }}>
                Save Profile Settings
              </IslandButton>
            </p>
          </IslandCard>
        </IslandCard>
      ) : null}

      {page === "admin" ? (
        <IslandCard style={{ marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>Admin: Testing & Operations</h2>
          <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
            This page groups operational and testing controls. Role gate is based on Discord role "Parent".
          </p>

          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Data Sync</h3>
            <p style={{ marginTop: 0, marginBottom: 0, opacity: 0.9, ...readableProseStyle }}>
              Automatic sync is enabled for profile, Discord member activity, game nights, and Steam libraries. This
              page now reflects live state instead of using manual sync controls.
            </p>
          </IslandCard>

          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Recommendation Tester</h3>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Uses currently selected members from Game Nights member chips.
            </p>
            <p style={{ marginTop: 0 }}>
              Selected members: <strong>{selectedMemberIds.length}</strong>
            </p>
            <IslandButton variant="primary" onClick={runRecommendation}>
              Run What Can We Play
            </IslandButton>
            {hasRecommendations ? (
              <ul>
                {results.map((game) => (
                  <li key={game.appId}>
                    {game.name} - score {game.score} ({game.reason})
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ opacity: 0.9 }}>No tester results yet.</p>
            )}
          </IslandCard>

          <IslandCard as="div" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>News Curation Controls (Placeholder)</h3>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              These controls are UI-only for now. Later they will drive which AI-curated articles show in Home - News.
            </p>
            <p style={{ marginTop: 0, marginBottom: 8 }}>Keywords / genres / titles</p>
            <input value={newsKeywords} onChange={(e) => setNewsKeywords(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            <p style={{ marginTop: 10, marginBottom: 8 }}>Approved sources</p>
            <input value={newsSources} onChange={(e) => setNewsSources(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            <p style={{ marginBottom: 0 }}>
              <IslandButton variant="primary" onClick={saveNewsControlsPlaceholder} style={{ marginTop: 10 }}>
                Save placeholder curation settings
              </IslandButton>
            </p>
          </IslandCard>

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}>Profile payload (debug)</summary>
            <pre
              style={{
                background: islandTheme.color.panelMutedBg,
                color: islandTheme.color.textPrimary,
                border: `1px solid ${islandTheme.color.border}`,
                borderRadius: islandTheme.radius.control,
                padding: "0.7rem",
                overflowX: "auto",
                marginTop: 8
              }}
            >
              {profileJson}
            </pre>
          </details>
        </IslandCard>
      ) : null}

      <style>{`
        @keyframes islandToastIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes islandBladePulse {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.65);
          }
          40% {
            transform: translateY(-1px) scale(1.012);
            box-shadow: 0 0 0 7px rgba(56, 189, 248, 0.18);
          }
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
          }
        }
        @keyframes islandVoteBadgePop {
          0% {
            opacity: 0;
            transform: translateY(-5px) scale(0.9);
          }
          20% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
        }
      `}</style>

      {toasts.length ? (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 90,
            display: "grid",
            gap: 8,
            width: "min(360px, calc(100vw - 24px))",
            maxWidth: "calc(100vw - 24px)"
          }}
        >
          {toasts.map((toast) => {
            const toneStyle =
              toast.tone === "error"
                ? {
                    border: `1px solid ${islandTheme.color.danger}`,
                    background: islandTheme.color.dangerSurface,
                    color: islandTheme.color.dangerText
                  }
                : toast.tone === "success"
                  ? {
                      border: `1px solid ${islandTheme.color.success}`,
                      background: islandTheme.color.success,
                      color: islandTheme.color.successText
                    }
                  : {
                      border: `1px solid ${islandTheme.color.info}`,
                      background: islandTheme.color.info,
                      color: islandTheme.color.infoText
                    };
            return (
              <div
                key={toast.id}
                style={{
                  borderRadius: islandTheme.radius.control,
                  padding: "0.58rem 0.6rem 0.58rem 0.7rem",
                  boxShadow: islandTheme.shadow.toast,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  animation: "islandToastIn 180ms ease-out",
                  ...toneStyle
                }}
              >
                <span>{toast.message}</span>
                <button
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    opacity: 0.86,
                    padding: "0 0.12rem"
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
