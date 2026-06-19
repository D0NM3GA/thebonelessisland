# Visual Refresh — Follow-up Plan

Follow-up to the island visual refresh (video scene, Space Grotesk, themed primitives,
commit `8196810`). Seven changes + a design-system hardening pass so these choices are
made autonomously in future work.

**Execution model: 10 / 80 / 10**
- **10% — Plan (Opus).** This document. All decisions, exact values, and file:line targets
  are encoded here so the build phase needs no architectural judgment. *(Done.)*
- **80% — Build (switch to Sonnet 4.6).** Execute Sections A–G as written. Deterministic,
  mechanical edits. No design decisions required — every value is specified below.
- **10% — Review (switch back to Opus 4.8).** Visual verification via the Preview/browser
  MCP: tune the final alpha/scrim values against the rendered site, run the dead-space pass
  (Section F), confirm legibility in both day and night modes, then commit.

> **Why the split:** Sections A–E + G are precise edits with known values → cheap model.
> Section F (dead space) and final opacity tuning need eyes on the rendered page → Opus + screenshots.

---

## A. Login screen uses the video backdrop

**Problem.** `LoginScreen.tsx` paints a hardcoded gradient and renders *outside* the scene
shell, so the new video never shows pre-auth.

- `apps/web/src/pages/LoginScreen.tsx:215-216` — hardcoded `linear-gradient(180deg, #0c4a6e …)`.
- `apps/web/src/App.tsx:~1634-1641` — unauthenticated branch renders `LoginScreen` outside `IslandSceneShell`.
- `apps/web/src/main.tsx:26-28` — `IslandSceneShell` currently wraps only `<App>`.

**Do.**
1. Make the scene shell wrap **both** auth states. Simplest: in `main.tsx`, keep
   `<IslandSceneShell>` mounted around everything (it already provides `DayNightProvider`),
   and let `App` render either `LoginScreen` or the authed app *inside* it. Verify the login
   exit animation in `App.tsx` still works when the shell is always mounted.
2. In `LoginScreen.tsx`, delete the gradient `background` (215-216) so the inherited video
   shows through. Keep the login card/panel itself on a themed translucent surface
   (`panelBg` + glass blur) for legibility over the video.

**Verify (build phase):** load the app logged-out → video plays behind the login card.

---

## B. Rich presence in the user menu (backend-only)

**Problem.** `GET /profile/me` returns the raw legacy `rich_presence_text` column
(voice-only, migration 006) and falls back to the literal string `"Presence unavailable"`.
It never composes the Discord game activity or Steam in-game title — even though
`GET /members` already does and the Friends Online card already shows it.

- `apps/api/src/routes/profile.ts:79` — selects `gm.rich_presence_text`.
- `apps/api/src/routes/profile.ts:133` — `richPresenceText: row.rich_presence_text ?? "Presence unavailable"`.
- Reference implementation to mirror: `apps/api/src/routes/members.ts:12-27` (`activityText()`)
  and its SELECT (~line 327) which already pulls `activity_name`, `activity_type`, `presence_status`.

**Do (in `profile.ts` only).**
1. Add `gm.activity_name`, `gm.activity_type` to the SELECT (the `guild_members` join `gm`
   is already present; `presence_status` optional). `steam_game_extra_info` is already selected.
2. Copy the `activityText(name, type)` helper from `members.ts` (or import/share it — prefer
   a tiny shared helper if one already exists; otherwise duplicate the 15-line switch).
3. Compose with the **same priority `/members` uses** (verify against members.ts before writing):
   ```
   const presence =
     activityText(row.activity_name, row.activity_type)   // "Playing Valorant"
     ?? row.steam_game_extra_info                          // Steam in-game title
     ?? row.rich_presence_text                             // legacy voice text
     ?? null;                                              // ← null, NOT "Presence unavailable"
   ```
4. Return `richPresenceText: presence` (drop the `"Presence unavailable"` literal — UserMenu
   already hides the card when the value is null/empty, `UserMenu.tsx:30,133`).

**No frontend change required** — `UserMenu.tsx:132-161` already renders the value.

> **Build-phase guardrail:** before writing, open `members.ts` and copy the exact column
> names and `activityText` body. If `activity_name`/`activity_type` are NOT on `guild_members`,
> STOP and report — that would mean a larger (migration + bot) change, not in scope here.

---

## C. Less opaque — let the video show through

**Goal:** more video visible on every page; text/images stay legible. Three levers.

### C1. Lower surface-token alpha (`apps/web/src/theme.ts`)
Replace these values. (Build phase applies as-is; review phase fine-tunes against the screen.)

**Night (`nightThemeVars`, lines 222-242):**
| Token | Line | From | To |
|-------|------|------|----|
| `--bi-app-bg` | 223 | `rgba(10, 24, 44, 0.62)` | `rgba(10, 24, 44, 0.42)` |
| `--bi-panel-bg` | 224 | `rgba(15, 32, 54, 0.74)` | `rgba(15, 32, 54, 0.58)` |
| `--bi-panel-muted-bg` | 226 | `#0b1220` (opaque) | `rgba(11, 18, 32, 0.62)` |
| `--bi-menu-bg` | 225 | `rgba(10, 22, 40, 0.97)` | `rgba(10, 22, 40, 0.90)` |

**Day (`dayThemeVars`, lines 244-264):**
| Token | Line | From | To |
|-------|------|------|----|
| `--bi-app-bg` | 245 | `rgba(255, 255, 255, 0.78)` | `rgba(255, 255, 255, 0.58)` |
| `--bi-panel-bg` | 246 | `rgba(255, 255, 255, 0.86)` | `rgba(255, 255, 255, 0.70)` |
| `--bi-panel-muted-bg` | 248 | `rgba(243, 233, 208, 0.92)` | `rgba(243, 233, 208, 0.78)` |
| `--bi-menu-bg` | 247 | `rgba(255, 252, 245, 0.97)` | `rgba(255, 252, 245, 0.92)` |

### C2. Lighten the scrim over the video (`apps/web/src/scene/IslandSceneShell.tsx`)
- A `scrim` value is composed above line 40 and painted at `IslandSceneShell.tsx:78`.
- Find the `scrim` definition and **reduce its opacity ~30%**. Keep a slight top-edge
  darkening so the fixed topbar text stays legible; lighten the body/center most.
- This is the single biggest "I can finally see the video" lever. **Flagged for review-phase
  visual tuning** — apply a first cut in build, finalize the number in review.

### C3. Blur is mandatory on every translucent surface
Now that `panel-muted-bg` is translucent, muted *surfaces* must pair it with backdrop blur
or text will float over moving video. In `apps/web/src/islandUi.tsx`, add
`backdropFilter: islandTheme.glass.blur` + `WebkitBackdropFilter` to:
- `IslandNewsPlaceholderCard` (~line 552)
- `IslandActiveMemberRow` (~line 587)
- any other primitive whose background is `panelMutedBg` and that renders as a surface
  (skip true inputs/code blocks if blur looks wrong; keep them legible).

**Skip `IslandGameBlade`** — it is dead/unused and slated for removal (STYLE_GUIDE line 97).

**Consolidate the one hardcoded override:** `ActionCard` (~`islandUi.tsx:1239-1241`) hardcodes
`rgba(28,40,66,.9)` / `rgba(255,255,255,.9)`. Repoint the dark value to `var(--bi-panel-bg)`
so it inherits the new alpha (keep its existing blur).

---

## D. Fix the logo (`apps/web/src/components/Topbar.tsx`, `Brand`)

The "thick black ring" = the border + the `0 0 0 1px` inset-style ring shadow.

- `Topbar.tsx:158-159` — `width: 38, height: 38` → **`44, 44`**.
- `Topbar.tsx:162` — **remove** `border: 1px solid cardBorder`.
- `Topbar.tsx:163` — replace
  `boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 6px 16px rgba(0,0,0,0.3)"`
  with a soft drop only, e.g. `boxShadow: "0 4px 12px rgba(0,0,0,0.28)"` (drop the ring).

Result: bigger, ring-free, recognizable logo.

---

## E. Search affordance: "Search" + Ctrl+K tooltip

- `apps/web/src/components/Topbar.tsx:97` — change `<span …>Ctrl K</span>` → `Search`.
  (Optionally drop `.island-mono` so "Search" reads as a word, not a keycap.)
- The button already has `title="Quick switcher (Ctrl+K)"` (line 80) — keep it; that *is* the
  hover tooltip telling people about the shortcut.
- In the opened modal `apps/web/src/components/QuickSwitcher.tsx` (footer/hint area ~251-265):
  ensure a visible "Ctrl+K" hint is present so the shortcut is discoverable once open. If the
  footer already lists keys, confirm Ctrl+K is among them; if not, add it.

---

## F. Dead-space pass *(review phase — needs eyes)*

Open the app via the Preview/browser MCP at desktop width and screenshot **Home, Games,
Community**. Target, with small token-level edits only:
- Oversized vertical gaps between stacked sections (tighten `SectionHead` margins / section gap).
- `.bi-main` rhythm — `max-width: 1200px; margin: 1.25rem auto; padding: clamp(0.9rem,2.5vw,1.5rem)`
  (in `IslandSceneShell.tsx` global CSS ~1137-1144). Adjust margin/padding if gutters read empty.
- Empty/short cards that leave a dead column in the 2-col hero rows (Home Featured+Friends,
  Games composer+patches) — equalize or let the short one shrink.
- The gap under the fixed 62px topbar (the spacer div in `App.tsx`).

Keep edits surgical and reversible; re-screenshot to confirm. Do **not** relocate the
Friends Online card (it stays top-right — project invariant).

---

## G. Design-system hardening — make these choices autonomous

So future screens get this right without being told. Edit the source-of-truth docs.

### `STYLE_GUIDE.md`
1. **Translucency principle (new section).** "Surfaces are translucent glass over the video
   scene. Target alpha: panels ~0.55–0.60 (night) / ~0.70 (day); app/body ~0.40 (night) /
   ~0.58 (day); menus ~0.90. **Every translucent surface MUST pair low alpha with
   `backdrop-filter` blur** (`glass.blur` / `blurStrong` / `blurMenu`) — low alpha without
   blur = unreadable text over moving video. Never ship an opaque slate slab over the scene."
2. **Scrim note.** Document that the scene scrim is the global lever for video visibility and
   lives in `IslandSceneShell.tsx`; lower it for more video, raise it for more contrast.
3. **Brand mark spec.** "Logo: ~44px, no border/ring; soft drop shadow only. The mark must be
   recognizable, not boxed."
4. **Affordance copy rule.** "Label interactive affordances with a plain word (`Search`), not a
   raw keycap (`Ctrl K`). Put the keyboard shortcut in the `title`/tooltip and in the opened
   surface's footer hint."
5. **Spacing rhythm.** "Favor breathable but not empty: trim dead vertical gaps between info
   sources; equalize 2-col hero rows so neither column leaves a dead gutter."
6. Update the **User menu** description line (85) to note presence shows live Discord activity
   / Steam in-game / voice, in that priority.

### `.cursor/context.md`
- Under VISUAL SYSTEM (lines 113-123): add the translucency + mandatory-blur rule and the scrim
  lever, mirroring STYLE_GUIDE so both source-of-truth files agree.
- Update the user-menu line (51) to state presence is composed (Discord activity → Steam
  in-game → voice → none), same priority as `/members`.

### `apps/web/src/theme.ts`
- Add a short comment above `nightThemeVars`/`dayThemeVars` stating the target alpha ranges and
  the "translucent surface ⇒ must blur" rule, so the next person editing tokens keeps the
  backdrop visible by default.

### Presence single-source-of-truth (code hygiene)
- After Section B, both `/profile/me` and `/members` compose presence the same way. If the
  `activityText` switch is now duplicated, extract it to one shared helper (e.g.
  `apps/api/src/lib/presence.ts`) and import it in both routes so they can never diverge again.

---

## File-change checklist

**Build phase (Sonnet 4.6):**
- [ ] A — `main.tsx`, `App.tsx`, `pages/LoginScreen.tsx` (login inside scene shell, drop gradient)
- [ ] B — `apps/api/src/routes/profile.ts` (compose presence; verify columns vs `members.ts` first)
- [ ] C1 — `apps/web/src/theme.ts` (8 token alpha values)
- [ ] C2 — `apps/web/src/scene/IslandSceneShell.tsx` (lighten scrim — first cut)
- [ ] C3 — `apps/web/src/islandUi.tsx` (blur on muted surfaces; repoint ActionCard dark bg)
- [ ] D — `apps/web/src/components/Topbar.tsx` (logo size + remove ring)
- [ ] E — `Topbar.tsx` + `QuickSwitcher.tsx` (search label + modal hint)
- [ ] G — `STYLE_GUIDE.md`, `.cursor/context.md`, `theme.ts` comment, extract `presence.ts`

**Review phase (Opus 4.8 + Preview MCP):**
- [ ] C2 — finalize scrim value against rendered day + night
- [ ] C1 — confirm legibility, nudge any alpha that reads too thin
- [ ] F — dead-space pass on Home / Games / Community
- [ ] Commit
