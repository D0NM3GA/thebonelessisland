import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, apiFetch } from "./api/client.js";
import { GAME_NIGHTS_TILE_BG_URL, getGameNightBanner } from "./assets.js";
import { AchievementsPage } from "./pages/Achievements.js";
import { AdminPage } from "./pages/Admin.js";
import { CommunityPage } from "./pages/Community.js";
import { GamesPage } from "./pages/Games.js";
import { HomePage } from "./pages/Home.js";
import { LibraryPage } from "./pages/Library.js";
import { ProfilePage } from "./pages/Profile.js";
import { ToastHost, useToastsFromStatus } from "./system/toast.js";
import { islandCopy, islandTheme } from "./theme.js";
import { Topbar } from "./components/Topbar.js";
import type {
  GameNight,
  GameNightAttendee,
  GuildMember,
  MeProfile,
  OwnedGameLite,
  PageId,
  Recommendation
} from "./types.js";

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("Idle");
  const [profileJson, setProfileJson] = useState("Not loaded");
  const [profileData, setProfileData] = useState<MeProfile | null>(null);
  const [gameNights, setGameNights] = useState<GameNight[]>([]);
  const [newNightTitle, setNewNightTitle] = useState<string>(islandCopy.placeholders.title);
  const [newNightScheduledFor, setNewNightScheduledFor] = useState("");
  const [selectedNightId, setSelectedNightId] = useState<number | null>(null);
  const [nightAttendees, setNightAttendees] = useState<GameNightAttendee[]>([]);
  const [currentUserAttendingSelectedNight, setCurrentUserAttendingSelectedNight] = useState(false);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [newsKeywords, setNewsKeywords] = useState("co-op, survival, strategy");
  const [newsSources, setNewsSources] = useState("Steam News, PC Gamer, IGN");
  const [profileSteamVisibility, setProfileSteamVisibility] = useState<"private" | "members" | "public">("members");
  const [profileFeatureOptIn, setProfileFeatureOptIn] = useState(true);
  const [ownedGames, setOwnedGames] = useState<OwnedGameLite[]>([]);
  const [ownedGameSearch, setOwnedGameSearch] = useState("");
  const [excludedOwnedGameAppIds, setExcludedOwnedGameAppIds] = useState<number[]>([]);
  const { toasts, dismiss: dismissToast } = useToastsFromStatus(status);

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
  const isAdmin = Boolean(profileData?.roleNames.includes("Parent"));

  const readableProseStyle = islandTheme.prose.readable;

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
    setNightAttendees([]);
    setCurrentUserAttendingSelectedNight(false);
  }, [gameNights, selectedNightId]);

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
    if (isAuthenticated !== true || page !== "games") return;

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
    if (isAuthenticated !== true || page !== "games" || !selectedNightId) return;

    let syncing = false;
    const runSelectedNightSync = async () => {
      if (syncing || document.hidden) return;
      syncing = true;
      try {
        await selectNight(selectedNightId, undefined, true);
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
      const response = await apiFetch("/recommendations/what-can-we-play", {
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
      const response = await apiFetch(`/profile/me`, { credentials: "include" });
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
    await apiFetch(`/auth/logout`, {
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
      const response = await apiFetch("/profile/me", {
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
      const response = await apiFetch("/steam/my-games", { credentials: "include" });
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
      const response = await apiFetch("/steam/sync-owned-games", {
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
      const response = await apiFetch("/members", { credentials: "include" });
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
      const response = await apiFetch(`/members/sync`, {
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

  async function loadGameNights(silent = false) {
    if (!silent) {
      setStatus("Loading game nights...");
    }
    try {
      const response = await apiFetch("/game-nights", { credentials: "include" });
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
      const response = await apiFetch("/game-nights", {
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
        await selectNight(data.id);
      }
      setStatus("Created game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create game night failed");
    }
  }

  async function selectNight(gameNightId: number, nightTitle?: string, silent = false) {
    if (!silent) {
      setStatus(`Loading ${nightTitle ?? "selected game night"}...`);
    }
    try {
      setSelectedNightId(gameNightId);
      await loadAttendees(gameNightId);
      if (!silent) {
        setStatus(`Loaded selected night`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(error instanceof Error ? error.message : "Night load failed");
      }
    }
  }

  async function loadAttendees(gameNightId: number) {
    const response = await apiFetch(`/game-nights/${gameNightId}/attendees`, {
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
      const response = await apiFetch(`/game-nights/${selectedNightId}/attendees/me`, {
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
      const response = await apiFetch(`/game-nights/${selectedNightId}/attendees/me`, {
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
      const response = await apiFetch(`/game-nights/${selectedNightId}/attendees`, {
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
      const response = await apiFetch(`/game-nights/${selectedNightId}/attendees`, {
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
          backdropFilter: islandTheme.glass.blurStrong,
          WebkitBackdropFilter: islandTheme.glass.blurStrong,
          padding: islandTheme.spacing.pagePaddingWide,
          borderRadius: islandTheme.radius.surface
        }}
      >
        <section
          style={{
            background: islandTheme.color.panelBg,
            backdropFilter: islandTheme.glass.blur,
            WebkitBackdropFilter: islandTheme.glass.blur,
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
    <>
      <Topbar
        page={page}
        onNavigate={setPage}
        profile={profileData}
        isAdmin={isAdmin}
        onLogout={() => void logout()}
      />
      <main
        style={{
          fontFamily: "Inter, Segoe UI, sans-serif",
          maxWidth: islandTheme.layout.appMaxWidth,
          margin: "1.25rem auto",
          color: islandTheme.color.textPrimary,
          backgroundColor: islandTheme.color.appBg,
          backdropFilter: islandTheme.glass.blurStrong,
          WebkitBackdropFilter: islandTheme.glass.blurStrong,
          padding: "clamp(0.9rem, 2vw, 1.2rem)",
          borderRadius: islandTheme.radius.surface
        }}
      >

      {page === "home" ? (
        <HomePage
          profile={profileData}
          activeMembers={activeMembers}
          totalMemberCount={guildMembers.length}
          onNavigate={setPage}
        />
      ) : null}

      {page === "games" ? (
        <GamesPage
          gameNights={gameNights}
          selectedNight={selectedNight}
          selectedNightId={selectedNightId}
          nightAttendees={nightAttendees}
          filteredGuildMembers={filteredGuildMembers}
          selectedMemberIds={selectedMemberIds}
          newNightTitle={newNightTitle}
          newNightScheduledFor={newNightScheduledFor}
          currentUserAttendingSelectedNight={currentUserAttendingSelectedNight}
          onSelectNight={(id, title) => void selectNight(id, title)}
          onNewNightTitleChange={setNewNightTitle}
          onNewNightScheduledForChange={setNewNightScheduledFor}
          onToggleSelectedMember={toggleSelectedMember}
          onCreateGameNight={createGameNight}
          onJoinSelectedNight={joinSelectedNight}
          onLeaveSelectedNight={leaveSelectedNight}
          onAddSelectedMembersToNight={addSelectedMembersToNight}
          onRemoveSelectedMembersFromNight={removeSelectedMembersFromNight}
          onNavigate={setPage}
        />
      ) : null}

      {page === "library" ? <LibraryPage onNavigate={setPage} /> : null}

      {page === "community" ? <CommunityPage isAdmin={isAdmin} onNavigate={setPage} /> : null}

      {page === "achievements" ? <AchievementsPage /> : null}

      {page === "profile" ? (
        <ProfilePage
          profileData={profileData}
          steamVisibility={profileSteamVisibility}
          onSteamVisibilityChange={setProfileSteamVisibility}
          ownedGames={ownedGames}
          ownedGameSearch={ownedGameSearch}
          onOwnedGameSearchChange={setOwnedGameSearch}
          excludedOwnedGameAppIds={excludedOwnedGameAppIds}
          onToggleExcludedOwnedGame={toggleExcludedOwnedGame}
          featureOptIn={profileFeatureOptIn}
          onFeatureOptInChange={setProfileFeatureOptIn}
          onSave={saveProfileSettings}
        />
      ) : null}

      {page === "admin" ? (
        <AdminPage
          selectedMemberCount={selectedMemberIds.length}
          recommendations={results}
          onRunRecommendation={runRecommendation}
          newsKeywords={newsKeywords}
          onNewsKeywordsChange={setNewsKeywords}
          newsSources={newsSources}
          onNewsSourcesChange={setNewsSources}
          onSaveNewsControls={saveNewsControlsPlaceholder}
          profileJson={profileJson}
        />
      ) : null}

      <style>{`
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

      </main>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
