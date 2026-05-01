import { IslandCard } from "../islandUi.js";
import { islandTheme } from "../theme.js";

export function AchievementsPage() {
  return (
    <IslandCard style={{ marginTop: 10 }}>
      <h2 className="island-display" style={{ marginTop: 0 }}>
        Achievements
      </h2>
      <p style={{ marginTop: 0, opacity: 0.9, ...islandTheme.prose.readable }}>
        Island-specific badges for attendance, participation, and milestones. Building later.
      </p>
      <p style={{ marginTop: 12, opacity: 0.75, fontSize: 13 }}>No grind. No competitive pressure. Just nuggets earned.</p>
    </IslandCard>
  );
}
