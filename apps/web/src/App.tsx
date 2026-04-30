import { useEffect, useMemo, useRef, useState } from "react";
import {
  IslandActiveMemberRow,
  IslandButton,
  IslandCard,
  IslandComingSoonTile,
  IslandGameCard,
  IslandMemberChip,
  IslandNewsPlaceholderCard,
  IslandStatusPill,
  IslandTileButton,
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
  maxPlayers: number;
  medianSessionMinutes: number;
  developers: string[];
  tags: string[];
  headerImageUrl: string | null;
};

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
const API_BASE_URL = "http://localhost:3000";

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
  const [voteValue, setVoteValue] = useState("1");
  const [nightVotes, setNightVotes] = useState<GameNightVote[]>([]);
  const [nightAttendees, setNightAttendees] = useState<GameNightAttendee[]>([]);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
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
  const selectedVoteGame = useMemo(
    () => availableGames.find((game) => String(game.appId) === voteAppId) ?? null,
    [availableGames, voteAppId]
  );
  const filteredOwnedGames = useMemo(() => {
    const query = ownedGameSearch.trim().toLowerCase();
    if (!query) return ownedGames;
    return ownedGames.filter((game) => game.name.toLowerCase().includes(query));
  }, [ownedGames, ownedGameSearch]);
  const hasRecommendations = results.length > 0;
  const hasGameNights = gameNights.length > 0;
  const hasAvailableGames = availableGames.length > 0;
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
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

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

  async function syncSteamGames() {
    setStatus("Syncing owned Steam games...");
    try {
      const response = await fetch("http://localhost:3000/steam/sync-owned-games", {
        method: "POST",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { syncedGames?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Steam sync failed (${response.status})`);
      }
      setStatus(`Steam sync complete (${data?.syncedGames ?? 0} game(s))`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Steam sync failed");
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

  async function loadGameNights() {
    setStatus("Loading game nights...");
    try {
      const response = await fetch("http://localhost:3000/game-nights", { credentials: "include" });
      const data = (await response.json().catch(() => null)) as { gameNights?: GameNight[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Game nights request failed (${response.status})`);
      }
      setGameNights(data?.gameNights ?? []);
      setStatus(`Loaded ${data?.gameNights?.length ?? 0} game night(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Game nights request failed");
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

  async function loadVotes(gameNightId: number, nightTitle?: string) {
    setStatus(`Loading votes for ${nightTitle ?? "selected game night"}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${gameNightId}/votes`, {
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { votes?: GameNightVote[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Vote load failed (${response.status})`);
      }
      setSelectedNightId(gameNightId);
      setNightVotes(data?.votes ?? []);
      await loadAttendees(gameNightId);
      await loadAvailableGames(gameNightId);
      setStatus(`Loaded ${data?.votes?.length ?? 0} vote row(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Vote load failed");
    }
  }

  async function loadAvailableGames(gameNightId: number) {
    const response = await fetch(`http://localhost:3000/game-nights/${gameNightId}/available-games`, {
      credentials: "include"
    });
    const data = (await response.json().catch(() => null)) as { games?: AvailableGame[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(data?.error ?? `Available game load failed (${response.status})`);
    }
    const games = data?.games ?? [];
    setAvailableGames(games);
    if (games.length > 0 && !games.some((game) => String(game.appId) === voteAppId)) {
      setVoteAppId(String(games[0].appId));
    }
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

  async function castVote() {
    if (!selectedNightId) return setStatus("Pick a game night first");
    const appId = Number(voteAppId);
    if (!Number.isInteger(appId) || appId <= 0) return setStatus("Select a game first");

    setStatus("Saving vote...");
    try {
      const vote = Number(voteValue);
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/votes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId, vote })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Vote save failed (${response.status})`);
      await loadVotes(selectedNightId);
      setStatus("Vote saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Vote save failed");
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
                  variant="secondary"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void loadProfile();
                  }}
                  style={{ marginRight: 0 }}
                >
                  Refresh Profile
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
                Welcome to The Boneless Island hub. Quick plan: sync your guild members, sync Steam libraries, then use
                Game Nights to pick what everyone can actually play.
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
              <IslandButton variant="secondary" onClick={() => void syncGuildMembers()}>
                Refresh activity
              </IslandButton>
            </div>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Rich presence is prepared. For now this uses synced voice/presence snapshots from Discord API data.
            </p>
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
            <h2 style={{ marginTop: 0 }}>Game Nights</h2>
            <p style={{ marginTop: 0, opacity: 0.9, ...readableProseStyle }}>
              Pick members, create nights, vote from common-owned games, then finalize or reopen as needed.
            </p>
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Select Night Members</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>Use member chips to define the night attendee group.</p>
            <p style={{ marginTop: 0 }}>
              Selected: <strong>{selectedMemberIds.length}</strong>
            </p>
            <p>
              <input
                placeholder={islandCopy.placeholders.memberSearch}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={inputStyle}
              />
              <IslandButton variant="secondary" onClick={selectAllFilteredMembers} style={{ marginLeft: 8 }}>
                Select filtered
              </IslandButton>
              <IslandButton variant="secondary" onClick={clearSelectedMembers} style={{ marginLeft: 8 }}>
                Clear
              </IslandButton>
              <IslandButton
                variant="secondary"
                onClick={useSelectedNightAttendeesAsSelection}
                style={{ marginLeft: 8 }}
              >
                Use selected night attendees
              </IslandButton>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0 }}>Create Night</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>Creates a new game night with selected members as attendees.</p>
            <p>
              <input
                placeholder="Game night title"
                value={newNightTitle}
                onChange={(e) => setNewNightTitle(e.target.value)}
                style={inputStyle}
              />
              <input
                type="datetime-local"
                value={newNightScheduledFor}
                onChange={(e) => setNewNightScheduledFor(e.target.value)}
                style={{ ...inputStyle, marginLeft: 8 }}
              />
              <IslandButton variant="primary" onClick={createGameNight} style={{ marginLeft: 8 }}>
                Create Night
              </IslandButton>
              <IslandButton variant="secondary" onClick={loadGameNights} style={{ marginLeft: 8 }}>
                Refresh Nights
              </IslandButton>
            </p>
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0 }}>Created Nights</h3>
            {hasGameNights ? (
              <ul>
                {gameNights.map((night) => (
                  <li key={night.id}>
                    {night.title} - {new Date(night.scheduledFor).toLocaleString()} - attendees: {night.attendeeCount}
                    {night.selectedGameName ? ` - FINAL: ${night.selectedGameName}` : ""}
                    {!night.selectedGameName && night.topGameName ? ` - top: ${night.topGameName}` : ""}
                    <IslandButton
                      variant="secondary"
                      onClick={() => loadVotes(night.id, night.title)}
                      style={{ marginLeft: 8 }}
                    >
                      Open
                    </IslandButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ opacity: 0.9 }}>{islandCopy.emptyStates.noNights}</p>
            )}
          </IslandCard>

          <IslandCard style={{ marginTop: 10 }}>
            <h3 style={{ marginTop: 0 }}>
              Selected Night: {selectedNight ? `${selectedNight.title}` : "none"}
            </h3>
            {!selectedNight ? (
              <p style={{ opacity: 0.9 }}>Open a night above to manage votes and attendees.</p>
            ) : (
              <>
                <p style={{ marginTop: 0, opacity: 0.9 }}>
                  Finalized: {selectedNight.selectedGameName ?? "No"} | Top vote: {selectedNight.topGameName ?? "n/a"}
                </p>
                <p>
                  <IslandButton variant="secondary" onClick={() => setIsSelectedNightPanelCollapsed((v) => !v)}>
                    {isSelectedNightPanelCollapsed ? "Expand details" : "Collapse details"}
                  </IslandButton>
                </p>
                {!isSelectedNightPanelCollapsed ? (
                  <>
                    <p style={{ marginBottom: 6 }}>
                      <strong>Available Games</strong> ({availableGames.length})
                    </p>
                    {hasAvailableGames ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                          gap: 10
                        }}
                      >
                        {availableGames.map((game) => {
                          const selected = String(game.appId) === voteAppId;
                          return (
                            <IslandGameCard
                              key={game.appId}
                              onClick={() => setVoteAppId(String(game.appId))}
                              selected={selected}
                              title={game.name}
                              subtitle={`owners ${game.owners} | votes ${game.voteTotal}`}
                              imageUrl={game.headerImageUrl}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ opacity: 0.9 }}>
                        No common games for all attendees yet. Ensure attendees have synced Steam libraries.
                      </p>
                    )}

                    <p>
                      <select value={voteAppId} onChange={(e) => setVoteAppId(e.target.value)} style={inputStyle}>
                        <option value="">Select available game</option>
                        {availableGames.map((game) => (
                          <option key={game.appId} value={String(game.appId)}>
                            {game.name} (votes {game.voteTotal})
                          </option>
                        ))}
                      </select>
                      <select
                        value={voteValue}
                        onChange={(e) => setVoteValue(e.target.value)}
                        style={{ ...inputStyle, marginLeft: 8 }}
                      >
                        <option value="1">Upvote (+1)</option>
                        <option value="0">Neutral (0)</option>
                        <option value="-1">Downvote (-1)</option>
                      </select>
                      <IslandButton variant="secondary" onClick={castVote} style={{ marginLeft: 8 }}>
                        Cast vote
                      </IslandButton>
                      <IslandButton variant="primary" onClick={() => finalizeSelectedNight()} style={{ marginLeft: 8 }}>
                        Finalize top vote
                      </IslandButton>
                      <IslandButton variant="danger" onClick={unfinalizeSelectedNight} style={{ marginLeft: 8 }}>
                        Reopen voting
                      </IslandButton>
                    </p>

                    <p>
                      <IslandButton variant="secondary" onClick={joinSelectedNight}>
                        Join night
                      </IslandButton>
                      <IslandButton variant="secondary" onClick={leaveSelectedNight} style={{ marginLeft: 8 }}>
                        Leave night
                      </IslandButton>
                      <IslandButton variant="secondary" onClick={addSelectedMembersToNight} style={{ marginLeft: 8 }}>
                        Add selected members
                      </IslandButton>
                      <IslandButton
                        variant="secondary"
                        onClick={removeSelectedMembersFromNight}
                        style={{ marginLeft: 8 }}
                      >
                        Remove selected members
                      </IslandButton>
                      <IslandButton variant="primary" onClick={recommendForSelectedNight} style={{ marginLeft: 8 }}>
                        Recommend for selected night
                      </IslandButton>
                    </p>
                  </>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                  <IslandCard as="div" style={{ padding: "0.65rem" }}>
                    <strong>Attendees</strong>
                    {hasNightAttendees ? (
                      <ul>
                        {nightAttendees.map((row) => (
                          <li key={row.discordUserId}>{row.username}</li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ opacity: 0.9 }}>No attendees loaded yet.</p>
                    )}
                  </IslandCard>
                  <IslandCard as="div" style={{ padding: "0.65rem" }}>
                    <strong>Vote Totals</strong>
                    {hasNightVotes ? (
                      <ul>
                        {nightVotes.map((row) => (
                          <li key={row.appId}>
                            {row.name}: {row.totalVote}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ opacity: 0.9 }}>No votes yet.</p>
                    )}
                  </IslandCard>
                </div>
              </>
            )}
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
              <IslandButton variant="secondary" onClick={() => void loadOwnedGames()}>
                Refresh owned games
              </IslandButton>
            </div>
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
                  <p style={{ margin: 0, opacity: 0.85 }}>No matching games. Sync Steam games first if needed.</p>
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
            <p>
              <IslandButton variant="secondary" onClick={() => void loadProfile()}>
                Refresh Profile
              </IslandButton>
              <IslandButton variant="secondary" onClick={() => void loadGuildMembers()} style={{ marginLeft: 8 }}>
                Load Guild Members
              </IslandButton>
              <IslandButton variant="primary" onClick={() => void syncGuildMembers()} style={{ marginLeft: 8 }}>
                Sync Guild Members
              </IslandButton>
              <IslandButton variant="secondary" onClick={syncSteamGames} style={{ marginLeft: 8 }}>
                Sync Steam Games
              </IslandButton>
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
                  onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
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
