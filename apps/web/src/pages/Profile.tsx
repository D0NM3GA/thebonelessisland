import { useMemo } from "react";
import { IslandButton, IslandCard, islandInputStyle } from "../islandUi.js";
import { NuggieBadge } from "../components/NuggieBadge.js";
import { islandTheme } from "../theme.js";
import type { MeProfile, OwnedGameLite } from "../types.js";

type SteamVisibility = "private" | "members" | "public";

type ProfilePageProps = {
  profileData: MeProfile | null;
  steamVisibility: SteamVisibility;
  onSteamVisibilityChange: (value: SteamVisibility) => void;
  ownedGames: OwnedGameLite[];
  ownedGameSearch: string;
  onOwnedGameSearchChange: (value: string) => void;
  excludedOwnedGameAppIds: number[];
  onToggleExcludedOwnedGame: (appId: number) => void;
  featureOptIn: boolean;
  onFeatureOptInChange: (value: boolean) => void;
  onSave: () => void;
};

export function ProfilePage({
  profileData,
  steamVisibility,
  onSteamVisibilityChange,
  ownedGames,
  ownedGameSearch,
  onOwnedGameSearchChange,
  excludedOwnedGameAppIds,
  onToggleExcludedOwnedGame,
  featureOptIn,
  onFeatureOptInChange,
  onSave
}: ProfilePageProps) {
  const filteredOwnedGames = useMemo(() => {
    const query = ownedGameSearch.trim().toLowerCase();
    if (!query) return ownedGames;
    return ownedGames.filter((game) => game.name.toLowerCase().includes(query));
  }, [ownedGames, ownedGameSearch]);

  return (
    <IslandCard style={{ marginTop: 10 }}>
      <h2 style={{ marginTop: 0 }}>User Profile Settings</h2>
      <p style={{ marginTop: 0, opacity: 0.9, ...islandTheme.prose.readable }}>
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

      {profileData && !profileData.nuggiesOptedOut && (
        <IslandCard as="div" style={{ marginTop: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Nuggies</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              ₦{profileData.nuggieBalance.toLocaleString()}
              <span style={{ fontSize: 14, fontWeight: 400, color: islandTheme.color.textMuted, marginLeft: 6 }}>Nuggies</span>
            </div>
            {profileData.equippedItems.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {profileData.equippedItems.map((item) => (
                  <NuggieBadge key={item.id} item={item} size="sm" />
                ))}
              </div>
            )}
          </div>
        </IslandCard>
      )}

      <IslandCard as="div" style={{ marginTop: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Privacy & Library Preferences</h3>
        <p style={{ marginTop: 0, marginBottom: 8 }}>Steam library visibility</p>
        <select
          value={steamVisibility}
          onChange={(event) => onSteamVisibilityChange(event.target.value as SteamVisibility)}
          style={{ ...islandInputStyle, width: "100%" }}
        >
          <option value="private">Private (only you)</option>
          <option value="members">Members only</option>
          <option value="public">Public</option>
        </select>

        <p style={{ marginTop: 12, marginBottom: 8 }}>Exclude owned games from public visibility</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={ownedGameSearch}
            onChange={(event) => onOwnedGameSearchChange(event.target.value)}
            placeholder="Search your owned games"
            style={{ ...islandInputStyle, flex: 1, minWidth: 240 }}
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
                    onChange={() => onToggleExcludedOwnedGame(game.appId)}
                  />
                  <span>{game.name}</span>
                </label>
              ))
            ) : (
              <p style={{ margin: 0, opacity: 0.85 }}>
                No matching games yet. Steam updates automatically while online.
              </p>
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
            checked={featureOptIn}
            onChange={(event) => onFeatureOptInChange(event.target.checked)}
          />
          Participate in optional feature previews
        </label>

        <p style={{ marginBottom: 0 }}>
          <IslandButton variant="primary" onClick={onSave} style={{ marginTop: 10 }}>
            Save Profile Settings
          </IslandButton>
        </p>
      </IslandCard>
    </IslandCard>
  );
}
