import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";

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

export function App() {
  const [page, setPage] = useState<PageId>("home");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("Idle");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [profileJson, setProfileJson] = useState("Not loaded");
  const [profileData, setProfileData] = useState<MeProfile | null>(null);
  const [gameNights, setGameNights] = useState<GameNight[]>([]);
  const [newNightTitle, setNewNightTitle] = useState("Friday Island Session");
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
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.innerWidth < 1000);
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth < 760);
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

  const inputStyle: CSSProperties = {
    background: "#0b1220",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "0.5rem 0.65rem"
  };

  const buttonBase: CSSProperties = {
    borderRadius: 10,
    border: "1px solid #334155",
    padding: "0.48rem 0.75rem",
    cursor: "pointer",
    fontWeight: 600
  };

  const buttonPrimary: CSSProperties = {
    ...buttonBase,
    background: "#2563eb",
    borderColor: "#2563eb",
    color: "#eff6ff"
  };

  const buttonSecondary: CSSProperties = {
    ...buttonBase,
    background: "#1e293b",
    color: "#e2e8f0"
  };

  const buttonDanger: CSSProperties = {
    ...buttonBase,
    background: "#7f1d1d",
    borderColor: "#7f1d1d",
    color: "#fee2e2"
  };

  const sectionCardStyle: CSSProperties = {
    background: "#111827",
    border: "1px solid #253042",
    borderRadius: 12,
    padding: "0.95rem"
  };

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
    void loadProfile(true);
    void loadGuildMembers(true);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsNarrowViewport(window.innerWidth < 1000);
      setIsCompactViewport(window.innerWidth < 760);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
      const response = await fetch("http://localhost:3000/profile/me", { credentials: "include" });
      const data = (await response.json()) as { profile?: MeProfile | null };
      if (!response.ok) {
        throw new Error(`Profile load failed (${response.status})`);
      }
      const profile = data.profile ?? null;
      setProfileData(profile);
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
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Profile load failed");
      }
    }
  }

  async function logout() {
    setStatus("Logging out...");
    await fetch("http://localhost:3000/auth/logout", {
      method: "POST",
      credentials: "include"
    }).catch(() => undefined);
    setProfileData(null);
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

  async function syncGuildMembers() {
    setStatus("Syncing guild members from Discord...");
    try {
      const response = await fetch("http://localhost:3000/members/sync", {
        method: "POST",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as
        | { syncedMembers?: number; error?: string; details?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.details ?? data?.error ?? `Member sync failed (${response.status})`);
      }
      await loadGuildMembers(true);
      await loadProfile(true);
      setStatus(`Synced ${data?.syncedMembers ?? 0} guild member(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Member sync failed");
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

  return (
    <main
      style={{
        fontFamily: "Inter, Segoe UI, sans-serif",
        maxWidth: 1200,
        margin: "1.25rem auto",
        color: "#e5e7eb",
        backgroundColor: "#0f172a",
        padding: isNarrowViewport ? "0.9rem" : "1.2rem",
        borderRadius: 14
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setPage("home")} style={page === "home" ? buttonPrimary : buttonSecondary}>
            Home
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {isAdmin ? (
            <button onClick={() => setPage("admin")} style={page === "admin" ? buttonPrimary : buttonSecondary}>
              Admin
            </button>
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
                  style={{ width: 34, height: 34, borderRadius: "999px", border: "1px solid #334155" }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "999px",
                    border: "1px solid #334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#1e293b",
                    fontSize: 12
                  }}
                >
                  ?
                </div>
              )}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{profileData?.displayName ?? "Not signed in"}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{profileData?.richPresenceText ?? "Presence pending"}</div>
              </div>
            </button>
            <span
              style={{
                borderRadius: 999,
                padding: "0.22rem 0.55rem",
                fontSize: 12,
                border: "1px solid #334155",
                background: profileData?.steamId64 ? "#14532d" : "#3f1d1d",
                color: profileData?.steamId64 ? "#dcfce7" : "#fee2e2",
                alignSelf: "flex-end"
              }}
            >
              Steam: {profileData?.steamId64 ? "Synced" : "Not synced"}
            </span>
            {isUserMenuOpen ? (
              <div
              style={{
                marginTop: 2,
                minWidth: 220,
                background: "#111827",
                border: "1px solid #334155",
                borderRadius: 10,
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
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setPage("profile");
                  }}
                  style={buttonSecondary}
                >
                  Profile Settings
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void loadProfile();
                  }}
                  style={buttonSecondary}
                >
                  Refresh Profile
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void logout();
                  }}
                  style={buttonDanger}
                >
                  Logout
                </button>
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
              ...sectionCardStyle,
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
                backgroundSize: isNarrowViewport ? "250px" : "420px",
                opacity: 0.16,
                pointerEvents: "none"
              }}
            />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
              <h1 style={{ marginTop: 0, fontSize: isNarrowViewport ? 28 : 40 }}>Welcome to the Island</h1>
              <p style={{ fontSize: 16, opacity: 0.95 }}>
                Welcome to The Boneless Island hub. Quick plan: sync your guild members, sync Steam libraries, then use
                Game Nights to pick what everyone can actually play.
              </p>
            </div>
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isCompactViewport ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: 14,
                alignItems: "stretch"
              }}
            >
              <button
                onClick={() => setPage("gameNights")}
                onMouseEnter={() => setHoveredHomeTile("gameNights")}
                onMouseLeave={() => setHoveredHomeTile(null)}
                style={{
                  ...buttonBase,
                  width: "100%",
                  minHeight: isCompactViewport ? 150 : 260,
                  borderRadius: 14,
                  textAlign: "left",
                  color: "#f8fafc",
                  padding: "1rem",
                  border: "1px solid #3b82f6",
                  backgroundImage: `linear-gradient(160deg, rgba(7,15,35,0.45), rgba(10,18,30,0.8)), url("${GAME_NIGHTS_TILE_BG_URL}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow:
                    hoveredHomeTile === "gameNights"
                      ? "0 0 0 1px #60a5fa, 0 0 24px rgba(96,165,250,0.55)"
                      : "0 4px 14px rgba(2,6,23,0.45)",
                  transition: "box-shadow 160ms ease, transform 160ms ease",
                  transform: hoveredHomeTile === "gameNights" ? "translateY(-2px)" : "translateY(0)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  overflow: "hidden"
                }}
              >
                <div>
                  <div style={{ fontSize: isCompactViewport ? 36 : 32, fontWeight: 800, lineHeight: 1.05, marginBottom: 10 }}>
                    Game Nights
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.3, opacity: 0.97, maxWidth: 280 }}>
                    Create nights, vote on common-owned games, and finalize your pick.
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPage("bonelessTools")}
                onMouseEnter={() => setHoveredHomeTile("bonelessTools")}
                onMouseLeave={() => setHoveredHomeTile(null)}
                style={{
                  ...buttonBase,
                  width: "100%",
                  minHeight: isCompactViewport ? 150 : 260,
                  borderRadius: 14,
                  textAlign: "left",
                  color: "#f8fafc",
                  padding: "1rem",
                  border: "1px solid #22d3ee",
                  backgroundImage: `linear-gradient(160deg, rgba(7,15,35,0.45), rgba(10,18,30,0.82)), url("${BONELESS_TOOLS_TILE_BG_URL}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow:
                    hoveredHomeTile === "bonelessTools"
                      ? "0 0 0 1px #22d3ee, 0 0 24px rgba(34,211,238,0.55)"
                      : "0 4px 14px rgba(2,6,23,0.45)",
                  transition: "box-shadow 160ms ease, transform 160ms ease",
                  transform: hoveredHomeTile === "bonelessTools" ? "translateY(-2px)" : "translateY(0)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  overflow: "hidden"
                }}
              >
                <div>
                  <div style={{ fontSize: isCompactViewport ? 36 : 32, fontWeight: 800, lineHeight: 1.05, marginBottom: 10 }}>
                    Boneless Tools
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.3, opacity: 0.97, maxWidth: 280 }}>
                    Placeholder for planning tools like wishlist overlap and buy planning.
                  </div>
                </div>
              </button>

              <div
                aria-disabled="true"
                style={{
                  width: "100%",
                  minHeight: isCompactViewport ? 150 : 260,
                  borderRadius: 14,
                  textAlign: "left",
                  color: "#94a3b8",
                  padding: "1rem",
                  border: "1px dashed #334155",
                  background: "linear-gradient(160deg, #0b1220, #0f172a)",
                  boxShadow: "0 4px 14px rgba(2,6,23,0.35)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  overflow: "hidden"
                }}
              >
                <div>
                  <div style={{ fontSize: isCompactViewport ? 36 : 32, fontWeight: 800, lineHeight: 1.05, marginBottom: 10, color: "#cbd5e1" }}>
                    Coming Soon
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.3 }}>Reserved for future modules.</div>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>News</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              Future AI-curated gaming news will live here, filtered by keywords, genres, titles, or community tags.
              Admins will control what appears through the Admin page curation controls.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <article style={{ border: "1px solid #334155", borderRadius: 10, padding: "0.7rem", background: "#0b1220" }}>
                <strong>Placeholder headline #1</strong>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Source: curated feed · tag: co-op</div>
              </article>
              <article style={{ border: "1px solid #334155", borderRadius: 10, padding: "0.7rem", background: "#0b1220" }}>
                <strong>Placeholder headline #2</strong>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Source: curated feed · tag: survival</div>
              </article>
            </div>
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Who's active in Discord right now</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              Rich presence is prepared. For now this uses synced voice/presence snapshots from Discord API data.
            </p>
            {activeMembers.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {activeMembers.map((member) => (
                  <div
                    key={member.discordUserId}
                    style={{
                      border: "1px solid #334155",
                      borderRadius: 10,
                      padding: "0.55rem 0.7rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "#0b1220"
                    }}
                  >
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.displayName}
                        style={{ width: 34, height: 34, borderRadius: "999px", border: "1px solid #334155" }}
                      />
                    ) : null}
                    <div>
                      <div style={{ fontWeight: 700 }}>{member.displayName}</div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        {member.richPresenceText ?? "Presence not yet available"}
                        {member.inVoice ? " - in voice" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.88 }}>
                No active members shown. Ask an admin to run member sync from the Admin page.
              </p>
            )}
          </section>
        </>
      ) : null}

      {page === "gameNights" ? (
        <>
          <section style={sectionCardStyle}>
            <h2 style={{ marginTop: 0 }}>Game Nights</h2>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              Pick members, create nights, vote from common-owned games, then finalize or reopen as needed.
            </p>
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 10 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Select Night Members</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>Use member chips to define the night attendee group.</p>
            <p style={{ marginTop: 0 }}>
              Selected: <strong>{selectedMemberIds.length}</strong>
            </p>
            <p>
              <input
                placeholder="Search members"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={inputStyle}
              />
              <button onClick={selectAllFilteredMembers} style={{ ...buttonSecondary, marginLeft: 8 }}>
                Select filtered
              </button>
              <button onClick={clearSelectedMembers} style={{ ...buttonSecondary, marginLeft: 8 }}>
                Clear
              </button>
              <button onClick={useSelectedNightAttendeesAsSelection} style={{ ...buttonSecondary, marginLeft: 8 }}>
                Use selected night attendees
              </button>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {filteredGuildMembers.map((member) => {
                const selected = selectedMemberIds.includes(member.discordUserId);
                return (
                  <button
                    key={member.discordUserId}
                    onClick={() => toggleSelectedMember(member.discordUserId)}
                    style={{
                      ...buttonBase,
                      borderRadius: 999,
                      background: selected ? "#2563eb" : "#1e293b",
                      color: "#e5e7eb",
                      border: selected ? "1px solid #2563eb" : "1px solid #334155",
                      padding: "0.26rem 0.62rem"
                    }}
                  >
                    {selected ? "✓ " : ""} {member.displayName}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 10 }}>
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
              <button onClick={createGameNight} style={{ ...buttonPrimary, marginLeft: 8 }}>
                Create Night
              </button>
              <button onClick={loadGameNights} style={{ ...buttonSecondary, marginLeft: 8 }}>
                Refresh Nights
              </button>
            </p>
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 10 }}>
            <h3 style={{ marginTop: 0 }}>Created Nights</h3>
            {hasGameNights ? (
              <ul>
                {gameNights.map((night) => (
                  <li key={night.id}>
                    {night.title} - {new Date(night.scheduledFor).toLocaleString()} - attendees: {night.attendeeCount}
                    {night.selectedGameName ? ` - FINAL: ${night.selectedGameName}` : ""}
                    {!night.selectedGameName && night.topGameName ? ` - top: ${night.topGameName}` : ""}
                    <button onClick={() => loadVotes(night.id, night.title)} style={{ ...buttonSecondary, marginLeft: 8 }}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ opacity: 0.9 }}>No game nights yet.</p>
            )}
          </section>

          <section style={{ ...sectionCardStyle, marginTop: 10 }}>
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
                  <button onClick={() => setIsSelectedNightPanelCollapsed((v) => !v)} style={buttonSecondary}>
                    {isSelectedNightPanelCollapsed ? "Expand details" : "Collapse details"}
                  </button>
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
                          gridTemplateColumns: isNarrowViewport ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: 10
                        }}
                      >
                        {availableGames.map((game) => {
                          const selected = String(game.appId) === voteAppId;
                          return (
                            <button
                              key={game.appId}
                              onClick={() => setVoteAppId(String(game.appId))}
                              style={{
                                ...buttonBase,
                                textAlign: "left",
                                border: selected ? "2px solid #60a5fa" : "1px solid #334155",
                                background: selected ? "#1e3a8a" : "#0b1220",
                                color: "#e5e7eb",
                                padding: 8
                              }}
                            >
                              {game.headerImageUrl ? (
                                <img
                                  src={game.headerImageUrl}
                                  alt={game.name}
                                  style={{
                                    width: "100%",
                                    height: 90,
                                    objectFit: "cover",
                                    borderRadius: 6,
                                    border: "1px solid #334155"
                                  }}
                                />
                              ) : null}
                              <div style={{ marginTop: 6, fontWeight: 600 }}>{game.name}</div>
                              <div style={{ fontSize: 12, opacity: 0.95 }}>
                                owners {game.owners} | votes {game.voteTotal}
                              </div>
                            </button>
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
                      <button onClick={castVote} style={{ ...buttonSecondary, marginLeft: 8 }}>
                        Cast vote
                      </button>
                      <button onClick={() => finalizeSelectedNight()} style={{ ...buttonPrimary, marginLeft: 8 }}>
                        Finalize top vote
                      </button>
                      <button onClick={unfinalizeSelectedNight} style={{ ...buttonDanger, marginLeft: 8 }}>
                        Reopen voting
                      </button>
                    </p>

                    <p>
                      <button onClick={joinSelectedNight} style={buttonSecondary}>
                        Join night
                      </button>
                      <button onClick={leaveSelectedNight} style={{ ...buttonSecondary, marginLeft: 8 }}>
                        Leave night
                      </button>
                      <button onClick={addSelectedMembersToNight} style={{ ...buttonSecondary, marginLeft: 8 }}>
                        Add selected members
                      </button>
                      <button onClick={removeSelectedMembersFromNight} style={{ ...buttonSecondary, marginLeft: 8 }}>
                        Remove selected members
                      </button>
                      <button onClick={recommendForSelectedNight} style={{ ...buttonPrimary, marginLeft: 8 }}>
                        Recommend for selected night
                      </button>
                    </p>
                  </>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: isNarrowViewport ? "1fr" : "1fr 1fr", gap: 10 }}>
                  <div style={{ ...sectionCardStyle, padding: "0.65rem" }}>
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
                  </div>
                  <div style={{ ...sectionCardStyle, padding: "0.65rem" }}>
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
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}

      {page === "bonelessTools" ? (
        <section style={{ ...sectionCardStyle, marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>Boneless Tools</h2>
          <p style={{ marginTop: 0, opacity: 0.9 }}>
            Placeholder page for community planning tools.
          </p>
          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Wishlist Planning (Coming next)</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              Goal: let members share wishlisted games, see overlap, and plan group purchases around discounts or events.
            </p>
          </div>
          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Future Tool Slots</h3>
            <ul style={{ marginBottom: 0 }}>
              <li>Event budget and buy planning</li>
              <li>Genre interest mapping</li>
              <li>Weekly community poll helpers</li>
            </ul>
          </div>
        </section>
      ) : null}

      {page === "profile" ? (
        <section style={{ ...sectionCardStyle, marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>User Profile Settings</h2>
          <p style={{ marginTop: 0, opacity: 0.9 }}>
            Manage your personal account preferences and privacy options.
          </p>

          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Account</h3>
            <p style={{ marginTop: 0, marginBottom: 4 }}>
              <strong>Display Name:</strong> {profileData?.displayName ?? "Not signed in"}
            </p>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              <strong>Discord Username:</strong> @{profileData?.username ?? "unknown"}
            </p>
          </div>

          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
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
              <button onClick={() => void loadOwnedGames()} style={buttonSecondary}>
                Refresh owned games
              </button>
            </div>
            {profileData?.steamId64 ? (
              <div
                style={{
                  marginTop: 8,
                  border: "1px solid #334155",
                  borderRadius: 10,
                  padding: "0.55rem",
                  maxHeight: 220,
                  overflowY: "auto",
                  background: "#0b1220"
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
              <button onClick={saveProfileSettings} style={{ ...buttonPrimary, marginTop: 10 }}>
                Save Profile Settings
              </button>
            </p>
          </div>
        </section>
      ) : null}

      {page === "admin" ? (
        <section style={{ ...sectionCardStyle, marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>Admin: Testing & Operations</h2>
          <p style={{ marginTop: 0, opacity: 0.9 }}>
            This page groups operational and testing controls. Role gate is based on Discord role "Parent".
          </p>

          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Data Sync</h3>
            <p>
              <button onClick={() => void loadProfile()} style={buttonSecondary}>
                Refresh Profile
              </button>
              <button onClick={() => void loadGuildMembers()} style={{ ...buttonSecondary, marginLeft: 8 }}>
                Load Guild Members
              </button>
              <button onClick={syncGuildMembers} style={{ ...buttonPrimary, marginLeft: 8 }}>
                Sync Guild Members
              </button>
              <button onClick={syncSteamGames} style={{ ...buttonSecondary, marginLeft: 8 }}>
                Sync Steam Games
              </button>
            </p>
          </div>

          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Recommendation Tester</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              Uses currently selected members from Game Nights member chips.
            </p>
            <p style={{ marginTop: 0 }}>
              Selected members: <strong>{selectedMemberIds.length}</strong>
            </p>
            <button onClick={runRecommendation} style={buttonPrimary}>
              Run What Can We Play
            </button>
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
          </div>

          <div style={{ ...sectionCardStyle, marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>News Curation Controls (Placeholder)</h3>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              These controls are UI-only for now. Later they will drive which AI-curated articles show in Home - News.
            </p>
            <p style={{ marginTop: 0, marginBottom: 8 }}>Keywords / genres / titles</p>
            <input value={newsKeywords} onChange={(e) => setNewsKeywords(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            <p style={{ marginTop: 10, marginBottom: 8 }}>Approved sources</p>
            <input value={newsSources} onChange={(e) => setNewsSources(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            <p style={{ marginBottom: 0 }}>
              <button onClick={saveNewsControlsPlaceholder} style={{ ...buttonPrimary, marginTop: 10 }}>
                Save placeholder curation settings
              </button>
            </p>
          </div>

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer" }}>Profile payload (debug)</summary>
            <pre
              style={{
                background: "#0b1220",
                color: "#e5e7eb",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: "0.7rem",
                overflowX: "auto",
                marginTop: 8
              }}
            >
              {profileJson}
            </pre>
          </details>
        </section>
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
            width: isNarrowViewport ? "calc(100vw - 24px)" : 360,
            maxWidth: "calc(100vw - 24px)"
          }}
        >
          {toasts.map((toast) => {
            const toneStyle =
              toast.tone === "error"
                ? { border: "1px solid #7f1d1d", background: "#3f1d1d", color: "#fee2e2" }
                : toast.tone === "success"
                  ? { border: "1px solid #14532d", background: "#14532d", color: "#dcfce7" }
                  : { border: "1px solid #1e3a8a", background: "#1e3a8a", color: "#dbeafe" };
            return (
              <div
                key={toast.id}
                style={{
                  borderRadius: 10,
                  padding: "0.58rem 0.6rem 0.58rem 0.7rem",
                  boxShadow: "0 8px 24px rgba(2, 6, 23, 0.42)",
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
