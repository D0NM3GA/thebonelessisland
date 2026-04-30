import { CSSProperties, useEffect, useMemo, useState } from "react";

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

export function App() {
  const [memberIds, setMemberIds] = useState("111,222");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("Idle");
  const [steamId64, setSteamId64] = useState("");
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
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.innerWidth < 960);

  const parsedManualMembers = useMemo(
    () => memberIds.split(",").map((id) => id.trim()).filter(Boolean),
    [memberIds]
  );
  const effectiveMemberIds = selectedMemberIds.length ? selectedMemberIds : parsedManualMembers;
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
  const hasRecommendations = results.length > 0;
  const hasGameNights = gameNights.length > 0;
  const hasAvailableGames = availableGames.length > 0;
  const hasNightAttendees = nightAttendees.length > 0;
  const hasNightVotes = nightVotes.length > 0;

  const inputStyle: CSSProperties = {
    background: "#0b1220",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "0.48rem 0.6rem"
  };

  const buttonBase: CSSProperties = {
    borderRadius: 8,
    border: "1px solid #334155",
    padding: "0.45rem 0.7rem",
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
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 10,
    padding: "0.85rem"
  };

  useEffect(() => {
    try {
      const savedMemberIds = window.localStorage.getItem("island.memberIds");
      const savedSelectedMemberIds = window.localStorage.getItem("island.selectedMemberIds");
      const savedMemberSearch = window.localStorage.getItem("island.memberSearch");

      if (savedMemberIds !== null) {
        setMemberIds(savedMemberIds);
      }
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
    } catch {
      // Ignore corrupted local storage and continue with defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("island.memberIds", memberIds);
  }, [memberIds]);

  useEffect(() => {
    window.localStorage.setItem("island.selectedMemberIds", JSON.stringify(selectedMemberIds));
  }, [selectedMemberIds]);

  useEffect(() => {
    window.localStorage.setItem("island.memberSearch", memberSearch);
  }, [memberSearch]);

  useEffect(() => {
    void loadProfile(true);
  }, []);

  useEffect(() => {
    const onResize = () => setIsNarrowViewport(window.innerWidth < 960);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function runRecommendation() {
    setStatus("Loading recommendations...");
    try {
      const response = await fetch("http://localhost:3000/recommendations/what-can-we-play", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberIds: effectiveMemberIds,
          sessionLength: "any",
          maxGroupSize: effectiveMemberIds.length
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
      setProfileData(data.profile ?? null);
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

  async function linkSteam() {
    setStatus("Linking Steam account...");
    try {
      const response = await fetch("http://localhost:3000/steam/link", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ steamId64 })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Steam link failed (${response.status})`);
      }
      await loadProfile();
      setStatus("Steam account linked");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Steam link failed");
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

  async function loadGuildMembers() {
    setStatus("Loading guild members...");
    try {
      const response = await fetch("http://localhost:3000/members", { credentials: "include" });
      const data = (await response.json().catch(() => null)) as { members?: GuildMember[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Member load failed (${response.status})`);
      }
      setGuildMembers(data?.members ?? []);
      setStatus(`Loaded ${data?.members?.length ?? 0} guild member(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Member load failed");
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
        | { syncedMembers?: number; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Member sync failed (${response.status})`);
      }
      await loadGuildMembers();
      setStatus(`Synced ${data?.syncedMembers ?? 0} guild member(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Member sync failed");
    }
  }

  function toggleSelectedMember(discordUserId: string) {
    const next = new Set(selectedMemberIds);
    if (next.has(discordUserId)) {
      next.delete(discordUserId);
    } else {
      next.add(discordUserId);
    }
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
      setStatus(`Created game night #${data?.id ?? "?"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create game night failed");
    }
  }

  async function loadVotes(gameNightId: number) {
    setStatus(`Loading votes for game night #${gameNightId}...`);
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
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }
    setStatus(`Joining game night #${selectedNightId}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees/me`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Join failed (${response.status})`);
      }
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Joined game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Join failed");
    }
  }

  async function leaveSelectedNight() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }
    setStatus(`Leaving game night #${selectedNightId}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees/me`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Leave failed (${response.status})`);
      }
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Left game night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Leave failed");
    }
  }

  async function addSelectedMembersToNight() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }
    if (!selectedMemberIds.length) {
      setStatus("Pick at least one member first");
      return;
    }

    setStatus(`Adding ${selectedMemberIds.length} member(s) to game night #${selectedNightId}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberIds: selectedMemberIds })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Add attendees failed (${response.status})`);
      }
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Added selected members to night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Add attendees failed");
    }
  }

  async function removeSelectedMembersFromNight() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }
    if (!selectedMemberIds.length) {
      setStatus("Pick at least one member first");
      return;
    }

    setStatus(`Removing ${selectedMemberIds.length} member(s) from game night #${selectedNightId}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/attendees`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberIds: selectedMemberIds })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Remove attendees failed (${response.status})`);
      }
      await loadGameNights();
      await loadAttendees(selectedNightId);
      setStatus("Removed selected members from night");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Remove attendees failed");
    }
  }

  async function castVote() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }

    const appId = Number(voteAppId);
    if (!Number.isInteger(appId) || appId <= 0) {
      setStatus("Select a game first");
      return;
    }

    setStatus(`Saving vote on game night #${selectedNightId}...`);
    try {
      const vote = Number(voteValue);
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/votes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId, vote })
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Vote save failed (${response.status})`);
      }
      await loadVotes(selectedNightId);
      setStatus("Vote saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Vote save failed");
    }
  }

  async function finalizeSelectedNight(appIdOverride?: number) {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }

    setStatus(`Finalizing game night #${selectedNightId}...`);
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
      if (!response.ok) {
        throw new Error(data?.error ?? `Finalize failed (${response.status})`);
      }
      await loadGameNights();
      setStatus(`Finalized pick for game night #${selectedNightId} (App ${data?.selectedAppId ?? "?"})`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Finalize failed");
    }
  }

  async function unfinalizeSelectedNight() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }

    setStatus(`Reopening game night #${selectedNightId}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/finalize`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Reopen failed (${response.status})`);
      }
      await loadGameNights();
      setStatus(`Reopened game night #${selectedNightId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reopen failed");
    }
  }

  async function recommendForSelectedNight() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }

    setStatus(`Loading recommendations for game night #${selectedNightId}...`);
    try {
      const response = await fetch(`http://localhost:3000/game-nights/${selectedNightId}/recommendations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberIds: effectiveMemberIds.length ? effectiveMemberIds : undefined,
          sessionLength: "any"
        })
      });
      const data = (await response.json().catch(() => null)) as
        | { recommendations?: Recommendation[]; memberIds?: string[]; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Recommendation request failed (${response.status})`);
      }
      setResults(data?.recommendations ?? []);
      const used = data?.memberIds?.length ? `for ${data.memberIds.join(", ")}` : "";
      setStatus(`Loaded ${data?.recommendations?.length ?? 0} recommendation(s) ${used}`.trim());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recommendation request failed");
    }
  }

  return (
    <main
      style={{
        fontFamily: "Inter, Segoe UI, sans-serif",
        maxWidth: 1120,
        margin: "2rem auto",
        color: "#e5e7eb",
        backgroundColor: "#111827",
        padding: isNarrowViewport ? "1rem" : "1.25rem 1.35rem",
        borderRadius: 12
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isNarrowViewport ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isNarrowViewport ? "stretch" : "flex-start",
          gap: 12
        }}
      >
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: isNarrowViewport ? 28 : 34 }}>The Boneless Island</h1>
          <p style={{ marginTop: 0, opacity: 0.9 }}>Discord-first community hub (Phase 1 starter).</p>
          <p>
            <a href="http://localhost:3000/auth/discord/login">Login with Discord</a>
          </p>
        </div>
        <div
          style={{
            minWidth: isNarrowViewport ? "auto" : 280,
            maxWidth: isNarrowViewport ? "100%" : 340,
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 10,
            padding: "0.75rem"
          }}
        >
          {profileData ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {profileData.avatarUrl ? (
                  <img
                    src={profileData.avatarUrl}
                    alt={profileData.displayName}
                    style={{ width: 48, height: 48, borderRadius: "999px", border: "1px solid #475569" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "999px",
                      background: "#1e293b",
                      border: "1px solid #475569",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    ?
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{profileData.displayName}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>@{profileData.username}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    {profileData.richPresenceText}
                    {profileData.inVoice ? " (voice active)" : ""}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {profileData.roleNames.length ? (
                  profileData.roleNames.map((role) => (
                    <span
                      key={role}
                      style={{
                        border: "1px solid #475569",
                        borderRadius: 999,
                        padding: "0.1rem 0.45rem",
                        fontSize: 12,
                        background: "#1e293b"
                      }}
                    >
                      {role}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, opacity: 0.85 }}>No synced roles yet</span>
                )}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>Profile not loaded. Sign in with Discord.</p>
          )}
        </div>
      </div>
      <p
        style={{
          marginTop: 10,
          marginBottom: 12,
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          padding: "0.45rem 0.7rem"
        }}
      >
        <strong>Status:</strong> {status}
      </p>
      <div
        style={{
          position: "sticky",
          top: 8,
          zIndex: 5,
          background: "#0b1220",
          border: "1px solid #334155",
          borderRadius: 10,
          padding: "0.55rem 0.7rem",
          marginBottom: 12
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
          Quick Actions - use these to refresh key data sources.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => void loadProfile()} style={buttonSecondary}>
            [Profile] Refresh
          </button>
          <button onClick={loadGuildMembers} style={buttonSecondary}>
            [Members] Load
          </button>
          <button onClick={syncGuildMembers} style={buttonSecondary}>
            [Members] Sync
          </button>
          <button onClick={loadGameNights} style={buttonSecondary}>
            [Nights] Refresh
          </button>
        </div>
      </div>
      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", opacity: 0.9 }}>Profile debug payload</summary>
        <pre
          style={{
            background: "#1f2937",
            color: "#e5e7eb",
            padding: "0.75rem",
            borderRadius: 8,
            overflowX: "auto",
            marginTop: 8
          }}
        >
          {profileJson}
        </pre>
      </details>
      <h3 style={{ marginBottom: 6 }}>Identity & Library</h3>
      <p style={{ marginTop: 0, opacity: 0.9 }}>
        Link your Steam account and keep your owned games synced for overlap-based recommendations.
      </p>
      <p>
        <input
          placeholder="SteamID64"
          value={steamId64}
          onChange={(e) => setSteamId64(e.target.value)}
          style={inputStyle}
        />
        <button onClick={linkSteam} style={{ ...buttonSecondary, marginLeft: 8 }}>
          Link Steam
        </button>
        <button onClick={syncSteamGames} style={{ ...buttonSecondary, marginLeft: 8 }}>
          Sync owned games
        </button>
      </p>
      <h3 style={{ marginBottom: 6, marginTop: 20 }}>Member Selection</h3>
      <p style={{ marginTop: 0, opacity: 0.9 }}>
        Pick members using chips (recommended). Manual IDs are a fallback.
      </p>
      <label>
        Member IDs (comma separated):{" "}
        <input value={memberIds} onChange={(e) => setMemberIds(e.target.value)} style={inputStyle} />
      </label>
      <button onClick={runRecommendation} style={{ ...buttonPrimary, marginLeft: 8 }}>
        What can we play?
      </button>
      <p>Member picker ({guildMembers.length} loaded):</p>
      <p>
        Selected via picker: {selectedMemberIds.length}
        <br />
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
          Clear selection
        </button>
        <button onClick={useSelectedNightAttendeesAsSelection} style={{ ...buttonSecondary, marginLeft: 8 }}>
          Use night attendees
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
                border: "1px solid #374151",
                background: selected ? "#2563eb" : "#1f2937",
                color: "#e5e7eb",
                padding: "0.25rem 0.6rem"
              }}
            >
              {selected ? "✓ " : ""} {member.displayName}
            </button>
          );
        })}
      </div>
      <h3 style={{ marginTop: 18, marginBottom: 8 }}>Recommendation Results</h3>
      <p style={{ marginTop: 0, opacity: 0.9 }}>
        Results are ranked by ownership overlap, group fit, and session length heuristic.
      </p>
      {hasRecommendations ? (
        <ul>
          {results.map((game) => (
            <li key={game.appId}>
              {game.name} - score {game.score} ({game.reason})
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ opacity: 0.85, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
          No recommendations yet. Select members, then run "What can we play?" or "Recommend for selected night."
        </p>
      )}
      <hr style={{ margin: "1.25rem 0", borderColor: "#374151" }} />
      <h2>Game night planning</h2>
      <div style={sectionCardStyle}>
        <p style={{ marginTop: 0, marginBottom: 6 }}>
          <strong>Create Night</strong>
        </p>
        <p style={{ marginTop: 0, opacity: 0.9 }}>
          Choose a title/time, then create a night with the currently selected member chips as initial attendees.
        </p>
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
            Create from selected members
          </button>
        </p>
      </div>
      <div style={{ ...sectionCardStyle, marginTop: 10 }}>
        <p style={{ marginTop: 0 }}>
          <strong>Created Nights</strong>
        </p>
        <p style={{ marginTop: 0, opacity: 0.9 }}>
          Open a night to manage attendees, vote on games, and finalize a pick.
        </p>
        <p>
          <button onClick={loadGameNights} style={{ ...buttonSecondary, marginLeft: 8 }}>
            Refresh nights
          </button>
        </p>
        {hasGameNights ? (
          <ul>
            {gameNights.map((night) => (
              <li key={night.id}>
                #{night.id} {night.title} - {new Date(night.scheduledFor).toLocaleString()} - attendees:{" "}
                {night.attendeeCount}
                {night.currentUserAttending ? " (you are in)" : ""}
                {night.selectedGameName ? ` - FINAL: ${night.selectedGameName}` : ""}
                {!night.selectedGameName && night.topGameName ? ` - top vote: ${night.topGameName}` : ""}
                <button onClick={() => loadVotes(night.id)} style={{ ...buttonSecondary, marginLeft: 8 }}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{ opacity: 0.85, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}
          >
            No game nights yet. Create one from selected members above.
          </p>
        )}
      </div>
      <div
        style={{
          ...sectionCardStyle,
          marginTop: 10
        }}
      >
        <p style={{ marginTop: 0, marginBottom: 6 }}>
          <strong>Selected Night</strong>: {selectedNight ? `#${selectedNight.id} ${selectedNight.title}` : "none"}
          <button
            onClick={() => setIsSelectedNightPanelCollapsed((current) => !current)}
            style={{ ...buttonSecondary, marginLeft: 8 }}
          >
            {isSelectedNightPanelCollapsed ? "Expand" : "Collapse"}
          </button>
        </p>
        {!selectedNight ? (
          <p
            style={{ opacity: 0.85, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}
          >
            Open a game night from "Created Nights" to manage attendees, vote, and finalize picks.
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              Finalized: {selectedNight.selectedGameName ? `${selectedNight.selectedGameName}` : "No"} | Top vote:{" "}
              {selectedNight.topGameName ?? "n/a"} | RSVP:{" "}
              {currentUserAttendingSelectedNight ? "Attending" : "Not attending"}
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
                            border: selected ? "2px solid #60a5fa" : "1px solid #374151",
                            borderRadius: 8,
                            background: selected ? "#1e3a8a" : "#111827",
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
                                border: "1px solid #374151"
                              }}
                            />
                          ) : null}
                          <div style={{ marginTop: 6, fontWeight: 600 }}>{game.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.95 }}>
                            App {game.appId} | owners {game.owners} | votes {game.voteTotal}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.9 }}>
                            {game.tags.length ? game.tags.slice(0, 3).join(", ") : "No tags yet"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    style={{
                      opacity: 0.85,
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 10
                    }}
                  >
                    No common games yet for this night. Make sure all attendees have synced Steam libraries.
                  </p>
                )}
            <p>
          <select value={voteAppId} onChange={(e) => setVoteAppId(e.target.value)} style={inputStyle}>
            <option value="">Select available game</option>
            {availableGames.map((game) => (
              <option key={game.appId} value={String(game.appId)}>
                {game.name} (App {game.appId}, owners {game.owners}, votes {game.voteTotal})
              </option>
            ))}
          </select>
          <select value={voteValue} onChange={(e) => setVoteValue(e.target.value)} style={{ ...inputStyle, marginLeft: 8 }}>
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
          <button
            onClick={() => {
              const appId = Number(voteAppId);
              if (!Number.isInteger(appId) || appId <= 0) {
                setStatus("Select a valid game to finalize");
                return;
              }
              void finalizeSelectedNight(appId);
            }}
            style={{ ...buttonPrimary, marginLeft: 8 }}
          >
            Finalize selected game
          </button>
          <button onClick={unfinalizeSelectedNight} style={{ ...buttonDanger, marginLeft: 8 }}>
            Reopen voting
          </button>
            </p>
            {selectedVoteGame ? (
              <div
                style={{
                  border: "1px solid #374151",
                  borderRadius: 8,
                  padding: "0.6rem",
                  background: "#111827",
                  marginBottom: "0.75rem"
                }}
              >
                <p style={{ marginTop: 0, marginBottom: 8 }}>
                  <strong>{selectedVoteGame.name}</strong> (App {selectedVoteGame.appId})
                </p>
                {selectedVoteGame.headerImageUrl ? (
                  <img
                    src={selectedVoteGame.headerImageUrl}
                    alt={selectedVoteGame.name}
                    style={{ width: "100%", maxWidth: 460, borderRadius: 6, border: "1px solid #374151" }}
                  />
                ) : null}
                <p style={{ marginBottom: 0 }}>
                  Developer: {selectedVoteGame.developers.length ? selectedVoteGame.developers.join(", ") : "Unknown"}
                  <br />
                  Tags: {selectedVoteGame.tags.length ? selectedVoteGame.tags.slice(0, 10).join(", ") : "Unavailable"}
                  <br />
                  Owners in night: {selectedVoteGame.owners} | Current vote total: {selectedVoteGame.voteTotal} | Max
                  players: {selectedVoteGame.maxPlayers} | Session: {selectedVoteGame.medianSessionMinutes} min
                </p>
              </div>
            ) : null}
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
          </>
        )}
      </div>
      <div style={{ ...sectionCardStyle, marginTop: 10 }}>
        <p style={{ marginTop: 0, marginBottom: 6 }}>
          <strong>Attendees</strong>
        </p>
        {hasNightAttendees ? (
          <ul>
            {nightAttendees.map((row) => (
              <li key={row.discordUserId}>
                {row.username} ({row.discordUserId})
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{ opacity: 0.85, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}
          >
            No attendees loaded yet.
          </p>
        )}
        <p style={{ marginTop: 14, marginBottom: 6 }}>
          <strong>Vote Totals</strong>
        </p>
        {hasNightVotes ? (
          <ul>
            {nightVotes.map((row) => (
              <li key={row.appId}>
                {row.name} (App {row.appId}): {row.totalVote}
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{ opacity: 0.85, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}
          >
            No votes yet for this night.
          </p>
        )}
      </div>
    </main>
  );
}
