import { useMemo, useState } from "react";

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
};

type GameNightVote = {
  appId: number;
  name: string;
  totalVote: number;
};

export function App() {
  const [memberIds, setMemberIds] = useState("111,222");
  const [results, setResults] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("Idle");
  const [steamId64, setSteamId64] = useState("");
  const [profileJson, setProfileJson] = useState("Not loaded");
  const [gameNights, setGameNights] = useState<GameNight[]>([]);
  const [newNightTitle, setNewNightTitle] = useState("Friday Island Session");
  const [newNightScheduledFor, setNewNightScheduledFor] = useState("");
  const [selectedNightId, setSelectedNightId] = useState<number | null>(null);
  const [voteAppId, setVoteAppId] = useState("");
  const [voteValue, setVoteValue] = useState("1");
  const [nightVotes, setNightVotes] = useState<GameNightVote[]>([]);

  const parsedMembers = useMemo(
    () => memberIds.split(",").map((id) => id.trim()).filter(Boolean),
    [memberIds]
  );

  async function runRecommendation() {
    setStatus("Loading recommendations...");
    try {
      const response = await fetch("http://localhost:3000/recommendations/what-can-we-play", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberIds: parsedMembers,
          sessionLength: "any",
          maxGroupSize: parsedMembers.length
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

  async function loadProfile() {
    setStatus("Loading profile...");
    try {
      const response = await fetch("http://localhost:3000/profile/me", { credentials: "include" });
      const data = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(`Profile load failed (${response.status})`);
      }
      setProfileJson(JSON.stringify(data, null, 2));
      setStatus("Profile loaded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile load failed");
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
          scheduledFor: iso
        })
      });
      const data = (await response.json().catch(() => null)) as { id?: number; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Create game night failed (${response.status})`);
      }
      await loadGameNights();
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
      setStatus(`Loaded ${data?.votes?.length ?? 0} vote row(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Vote load failed");
    }
  }

  async function castVote() {
    if (!selectedNightId) {
      setStatus("Pick a game night first");
      return;
    }

    setStatus(`Saving vote on game night #${selectedNightId}...`);
    try {
      const appId = Number(voteAppId);
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

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        maxWidth: 800,
        margin: "2rem auto",
        color: "#e5e7eb",
        backgroundColor: "#111827",
        padding: "1.25rem",
        borderRadius: 12
      }}
    >
      <h1>The Boneless Island</h1>
      <p>Discord-first community hub (Phase 1 starter).</p>
      <p>
        <a href="http://localhost:3000/auth/discord/login">Login with Discord</a>
      </p>
      <p>
        <button onClick={loadProfile}>Load profile</button>
      </p>
      <pre
        style={{
          background: "#1f2937",
          color: "#e5e7eb",
          padding: "0.75rem",
          borderRadius: 8,
          overflowX: "auto"
        }}
      >
        {profileJson}
      </pre>
      <p>
        <input
          placeholder="SteamID64"
          value={steamId64}
          onChange={(e) => setSteamId64(e.target.value)}
        />
        <button onClick={linkSteam} style={{ marginLeft: 8 }}>
          Link Steam
        </button>
        <button onClick={syncSteamGames} style={{ marginLeft: 8 }}>
          Sync owned games
        </button>
      </p>
      <label>
        Member IDs (comma separated):{" "}
        <input value={memberIds} onChange={(e) => setMemberIds(e.target.value)} />
      </label>
      <button onClick={runRecommendation} style={{ marginLeft: 8 }}>
        What can we play?
      </button>
      <hr style={{ margin: "1.25rem 0", borderColor: "#374151" }} />
      <h2>Game night planning</h2>
      <p>
        <input
          placeholder="Game night title"
          value={newNightTitle}
          onChange={(e) => setNewNightTitle(e.target.value)}
        />
        <input
          type="datetime-local"
          value={newNightScheduledFor}
          onChange={(e) => setNewNightScheduledFor(e.target.value)}
          style={{ marginLeft: 8 }}
        />
        <button onClick={createGameNight} style={{ marginLeft: 8 }}>
          Create game night
        </button>
        <button onClick={loadGameNights} style={{ marginLeft: 8 }}>
          Refresh game nights
        </button>
      </p>
      <ul>
        {gameNights.map((night) => (
          <li key={night.id}>
            #{night.id} {night.title} at {new Date(night.scheduledFor).toLocaleString()}{" "}
            {night.topGameName ? `(top: ${night.topGameName} / ${night.topGameVote})` : "(no votes yet)"}{" "}
            <button onClick={() => loadVotes(night.id)}>View votes</button>
          </li>
        ))}
      </ul>
      <p>
        Selected night: {selectedNightId ?? "none"}
        <br />
        <input
          placeholder="Game App ID"
          value={voteAppId}
          onChange={(e) => setVoteAppId(e.target.value)}
        />
        <select value={voteValue} onChange={(e) => setVoteValue(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="1">Upvote (+1)</option>
          <option value="0">Neutral (0)</option>
          <option value="-1">Downvote (-1)</option>
        </select>
        <button onClick={castVote} style={{ marginLeft: 8 }}>
          Cast vote
        </button>
      </p>
      <ul>
        {nightVotes.map((row) => (
          <li key={row.appId}>
            {row.name} (App {row.appId}): {row.totalVote}
          </li>
        ))}
      </ul>
      <p
        style={{
          background: "#1f2937",
          border: "1px solid #374151",
          padding: "0.5rem 0.75rem",
          borderRadius: 8
        }}
      >
        Status: {status}
      </p>
      <ul>
        {results.map((game) => (
          <li key={game.appId}>
            {game.name} - score {game.score} ({game.reason})
          </li>
        ))}
      </ul>
    </main>
  );
}
