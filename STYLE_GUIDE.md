# The Boneless Island UI Theme Guide

Use this as the default style baseline for new screens, placeholders, and UX copy.

## Brand Intent
- Community vibe: friendly adult gamer hangout, not a corporate dashboard.
- Setting: tropical island hub (sand, palms, shoreline, warm sky glow).
- Mascot identity: boneless nugget island citizens with personality and playful tone.

## Color Tokens
- `island-night`: `#0f172a` - app shell background
- `lagoon-panel`: `#111827` - card/panel background
- `deep-water`: `#0b1220` - nested panel/input background
- `foam-text`: `#e5e7eb` - primary text
- `tide-line`: `#334155` - neutral borders/dividers
- `lagoon-border`: `#253042` - card outline
- `palm-primary`: `#2563eb` - primary CTA
- `shore-secondary`: `#1e293b` - secondary actions
- `sunset-danger`: `#7f1d1d` - destructive actions
- `success-reef`: `#14532d` - success state background

## Layout + Shape
- Radius: 10px controls, 12px cards, 14px hero tiles/surfaces.
- Keep spacing soft and breathable; avoid dense enterprise packing.
- Favor rounded controls and layered cards over rigid grid-heavy chrome.

## Typography + Copy
- Tone: playful but mature, clear, concise, lightly self-aware.
- Prefer island-flavored phrasing where natural:
  - "Queue up a beach session"
  - "Crew online at the shoreline"
  - "No island crew in voice right now"
- Avoid overly meme-heavy or juvenile writing.

## Visual Language
- Use tropical/ocean gradients and warm highlights for key affordances.
- Keep contrast accessible; style should never reduce readability.
- Avoid default SaaS placeholders ("No data available", "Enter value").

## Component Defaults
- Primary button: `palm-primary` background + light text.
- Secondary button: `shore-secondary` background + neutral border.
- Inputs: `deep-water` background + `tide-line` border.
- Cards: `lagoon-panel` background + `lagoon-border` border.

## Shared UI Primitives
- Use `apps/web/src/islandUi.tsx` primitives before writing custom inline control styles.
- `IslandButton`: preferred for all action buttons (`primary`, `secondary`, `danger` variants).
- `IslandCard`: preferred container shell for sections and inset panels.
- `IslandTileButton`: preferred for home/feature promo tiles with background imagery.
- `IslandMemberChip`: preferred for selectable member pills/chips.
- `IslandGameCard`: preferred for selectable game rows/cards in recommendation and vote flows.
- `IslandComingSoonTile`: preferred placeholder tile for reserved feature slots.
- `IslandNewsPlaceholderCard`: preferred shell for temporary/placeholder news entries.
- `IslandActiveMemberRow`: preferred row for "who's active" member status blocks.
- `IslandStatusPill`: preferred compact state indicator for profile/sync badges.
- `islandButtonStyle(...)`: use only for special button layouts where raw `<button>` is required.

## Next Improvements
- Add mascot illustration token slots (hero overlays, sticker panels, loading/empty states).
- Add semantic typography tokens (section title, body, caption) for tighter consistency.
- Consider moving component-level variants (button/card/chip styles) into small reusable helpers.
