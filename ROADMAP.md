# The Boneless Island — Roadmap & Launch Plan

Living plan for shipping what's built, going live with what's mocked, and expanding
the site. Derived from a full live-vs-mock audit of the repo (2026-06-10, every
high-impact claim verified at `file:line`). Work top-down: blockers → go-live →
performance → expansion → delight. Check items off as they land.

## Status — 2026-06-10 implementation pass (uncommitted, on branch claude/gracious-matsumoto-916f07)

A 19-agent parallel pass shipped **all of P0, P1, P2(non-structural), and P4**. Repo
typechecks clean (web + api `tsc --noEmit`) and `vite build` succeeds; route
code-splitting verified (Admin is now its own 138 kB chunk, out of the initial bundle).
26 files changed, 2 new pages added. **Not yet committed — review the diff first.**

- ✅ **P0** — all three blockers fixed (general-news auth, two `fetch()` fixes, DEPLOY.md). *Remaining manual step: flip `API_BASE_URL` in the box's live `.env` to `http://api:3000`.*
- ✅ **P1** — ComingSoon pages, Steam unlink, StreamDrawer→presence, Community rewire + Clips/Clubs cut, dead-chrome sweep, Topbar search removed, Admin truth pass.
- ✅ **P2 (non-structural)** — code-split, member-sync→server cron, featured memo + staleness gate, crew-games/wishlist respond-then-enrich, vote dead-code purge, sync-recent cooldown, setState equality guards.
- ✅ **P4** — auto day/night (3-way), confetti on claim/buy, mobile breakpoints, Library PLAN seed, Nuggie chat polish, toast glow-up, time-aware hero.
- ⏸️ **Deferred (need sign-off / out of autonomous scope):** P3 appdetails migration build (runs DB migrations on the live box — locked contracts in `project_news_appdetails_plan.md`), P3 expansion features (Steam achievements surface, Sunday Tide Check, "Hot this week" trending, wishlist sale radar, Steam-unlock activity diffs, game detail drawer, islander profiles), P2 SSE event stream, P2 GHA buildx cache.

Known follow-ups surfaced during the pass (small, non-blocking):
- `GET /nuggies/me` does not expose a `dailyAmount` field, so the Achievements claim button reads "Claim Daily Nuggies" (no number). Add the field to show the amount.
- Community crew-card "Profile" buttons are disabled with a "coming soon" tooltip (no profile page yet → P3 islander profiles).
- Community game-night RSVP is a read-only status pill (no refresh callback in props); wiring join/leave needs App-owned state.
- Home "Open in Discord" falls back to in-app navigation (no guild-id env var reachable from the web build); add `VITE_DISCORD_GUILD_ID` to make it a real deep link.

---

> Conventions that constrain every item below:
> - Single AWS Graviton box, docker-compose, Cloudflare edge. Anything proposed fits one small box + modest AI budget.
> - Discord OAuth is the only login; Steam is opt-in enhancement.
> - **Game-night voting is deliberately removed — never re-add it.**
> - Homepage "Friends Online" card stays top-right.
> - Brand split: "Boneless Island" = org/auth/control surfaces; "Nuggie" = AI/bot mascot voice only.

---

## P0 — Launch blockers (do first; one evening)

- [ ] **Authenticate the general-news admin endpoints.** Six routes have no auth
  middleware — anyone reaching the API can trigger paid AI runs (`force=true`
  bypasses the 1h cooldown). Add the `requireSession`+`requireParentRole` pair
  already used on the cancel route 3 lines down.
  `apps/api/src/routes/generalNews.ts:181` (ingest), `:195` (curate),
  `:211` (embed-backfill), `:237` (debug-tags — also delete, it's self-described temp),
  `:393` (recurate), `:424` (recurate/status). Admin UI callers that must keep
  working send cookies already (`App.tsx:889/901/913/967`), so no client change.

- [ ] **Route the two raw `fetch()` calls through `apiFetch`.** Both are origin-relative,
  so in prod (web and API are cross-origin) they hit `index.html` and fail silently.
  `apps/web/src/pages/Admin.tsx:308` (`/settings/ai-cost-today` — the only AI-spend
  monitor) and `apps/web/src/pages/GamingNews.tsx:131` (news up/down votes that feed
  the ranking blend). `apiFetch` lives at `apps/web/src/api/client.ts:3`.

- [x] **Fix the `API_BASE_URL` deploy doc.** *(DEPLOY.md corrected 2026-06-10.)*
  Prod value must be `http://api:3000`, not the public hostname (Caddy 403s
  `/internal*`), or every bot internal call dies while looking deployed. Also fixed
  the clone-path mismatch (DEPLOY.md now clones into `/home/ssm-user/thebonelessisland`
  to match `deploy.yml:92`). **Action remaining: update the value in the box's live `.env`.**

---

## P1 — Go-live punch list (wiring-only; data/endpoints already exist)

Cheapest first. Each is verified to have a real backing source already in the app.

- [ ] **Two "Coming Soon" pages → real pages.**
  - Community Leaderboard ← `GET /nuggies/leaderboard` (returns top 25; Community &
    Achievements already render a 5-slice of it). `apps/api/src/routes/nuggies.ts:199`,
    stub at `App.tsx:1549`.
  - Nuggies History ← the ledger already in `GET /nuggies/me` (tx capped at LIMIT 20;
    add a `?limit`/paginated `GET /nuggies/me/transactions`). Stub at `App.tsx:1557`.
  - Remove the `badge: "soon"` markers in `MegaMenu.tsx:33,42` when these ship.

- [ ] **Steam unlink button.** `POST /steam/unlink` is fully built with zero callers,
  yet the onboarding modal promises "unlink any time from your profile"
  (`SteamOnboarding.tsx:200`). Add one button on `Profile.tsx` (Account card, `:49`)
  or Settings. Emits `steam.unlinked` already; the activity feed already renders it.
  Endpoint: `apps/api/src/routes/steam.ts:316`.

- [ ] **StreamDrawer → honest "Now in game" panel.** The permanent "● Live · 3" tab is
  three fabricated streamers (one playing a non-existent game) with invented viewer
  counts. Replace `STREAMS_MOCK` (`Games.tsx:1446`) with members carrying
  `richPresenceText`/`inVoice` — the same component already reads that at `Games.tsx:403`.
  Tab becomes "● In game · N", hide at zero. (Optional later: fuzzy-match against
  crew library so each row offers "you own it, jump in.")

- [ ] **Dead-chrome sweep.** Stop the UI implying features that don't exist.
  - *Wire:* Library `DETAILS` → `store.steampowered.com/app/{appId}` (`Library.tsx:369`,
    no onClick; appId is real per row). Drift-log "Full feed →" → news page
    (`Home.tsx:1553` SectionHead, pass `onAction`). "Open in Discord" →
    `discord.com/channels/{guildId}` deep link (`Home.tsx:1727`).
  - *Cut:* session-composer When/Where chips with invented voice-channel names
    (`Games.tsx:476`), Ping/Calendar/DM checkboxes + dead "Send invite" (`:553-621`),
    "Tune weights" (`:221`), Topbar search box that stores keystrokes into the void
    (`Topbar.tsx:17,173`), and the "weekly Sunday digest" marketing copy
    (`Home.tsx:1670`) **until** the Tide Check feature (P3) actually ships.

- [ ] **Community page → real data; cut Clips + Clubs.** Most-mock page; three of five
  sections have live data one prop away (component receives only
  `isAdmin`/`activityEvents`/`onNavigate` today, `Community.tsx:8`).
  - Crew carousel ← `guildMembers` (already in App state, `App.tsx:72`).
  - Forums list ← `GET /forums/categories` (real thread counts + last-activity,
    `forums.ts:122`; Forums page already consumes it).
  - Upcoming events ← `gameNights` (already in App state, `App.tsx:66`; mock events
    show stale "MAY 03" dates).
  - **Cut Clips and Clubs** — no media storage, no club concept anywhere in the
    schema; wrong size for ~15 people. Honest absence beats fake presence.

- [ ] **Admin truth pass** (lower priority — admin-only surface). Members & Roles ←
  `GET /members` (real roster already fetched for Economy ops two tabs over,
  `Admin.tsx:4729`); Audit Log ← `GET /activity` until a dedicated audit table earns
  its keep; Data Sync → small Parent-gated `GET /admin/sync-status` over real
  `last_synced_at` / `news_checked_at` / `ai_cost_ledger` timestamps, or delete the page.
  Mock at `Admin.tsx:1485` (roster), `:3445` (audit), `:1392` (connectors).

---

## P2 — Performance & robustness (single Graviton box)

- [ ] **Route-level code splitting.** `App.tsx:4-16` statically imports all 14 pages —
  the 5,314-line `Admin.tsx` ships to every member. Zero `React.lazy` in the codebase.
  Convert page imports to `React.lazy` + `Suspense`; optional `manualChunks` for the
  big pages. Caddy already serves `/assets/*` immutable (`Caddyfile:57`) — it just
  needs more than one chunk to cache.

- [ ] **Move guild-member sync to a server cron.** Every open tab POSTs `/members/sync`
  every 60s → guild check + member list + roles + per-member voice-state fetch against
  Discord REST, then mark-all-stale + per-row upsert, then 3 client refetches. Dominant
  recurring load + Discord rate-limit risk, recomputing what the bot gateway already
  pushes in real time. Replace with one `setInterval` in `server.ts` (already runs four
  crons, `:147`); clients only `GET /members`.
  Client trigger: `App.tsx:379`; endpoint: `members.ts:111`.

- [ ] **Memoize `/recommendations/featured` + staleness-gate its Steam calls.** Every
  request runs the recommender then makes **two** live Steam appdetails calls
  (no freshness check; image enrich fetches even when the image exists) + a DB UPDATE.
  Hit per tab on bootstrap, after every 60s member sync, and every 20 min — burning the
  box's single-IP Steam budget (~200 req/5min) on an identical result. Add a 5-min
  in-memory memo keyed by scope + a 24h `metadata_updated_at` gate.
  `recommendations.ts:114`; enrichers `gameCatalogEnrichment.ts:238,281`.

- [ ] **Make `/steam/crew-games` + `/steam/crew-wishlist` respond-then-enrich.** Both
  `await` up-to-50-game serial enrichment (Steam → CheapShark → IGDB, 2-4 serial
  fetches per cold game) *inside the request path*, which sits inside the bootstrap
  `Promise.all` — a cold catalog stalls the whole site. Adopt the `/games/news`
  fire-and-forget shape (`gameNews.ts:155`): return current rows, ingest in background.
  Add an `AbortController` timeout to `apiFetch` (`client.ts:3`) so a slow call can
  never hang the UI. `steam.ts:894`.

- [ ] **Cheap wins.**
  - Add a per-user cooldown to `/steam/sync-recent-games` (siblings have 30min; this
    has none and fires per-tab + per-refocus). `steam.ts:707`.
  - Drop the `game_night_votes` LATERAL from the 20s-polled `GET /game-nights`
    (`gameNights.ts:146`) and delete the 4 dead vote/finalize endpoints (`:376,508,548,
    588,647`) + the `topGameVote` web type vestige (`types.ts:33`). ~300 lines of
    zero-caller code. **This enforces the voting-removal decision — it is not a reversal.**
  - Equality-guard polled `setState`s and `React.memo` the page components (zero
    `React.memo` today; polls setState fresh arrays every tick). `App.tsx:1249,1154,1399`.

- [ ] **Deploy speed (later).** Three sequential cold `docker build` steps, full `npm ci`
  each, no cache. Add `cache-from/to: type=gha` + a matrix to parallelize. Matters
  because the pipeline has no rollback step — deploy latency = recovery time.
  `deploy.yml:47`.

- [ ] **SSE event stream (structural, later).** Replace the 60s/20s/15s polling loops
  with one `GET /events` SSE endpoint + in-memory subscriber set (single-instance makes
  this trivial — no Redis). Bot already pushes presence real-time; Friends Online goes
  genuinely live. `members.ts:83` (real-time source), poll consumers `App.tsx:394,426,448`.

---

## P3 — Expansion (new functionality on data already synced)

- [ ] **The appdetails / capability build (highest-leverage; plan already signed off).**
  Migrations stop at `044`; the locked 6-phase plan (045 store-details, 046 drop
  game_news AI, 047 drop legacy player columns; capability columns `is_online_coop`
  etc., price columns `price_final_cents` etc.; `GameNewsItem` gains `kind`+`highProfile`)
  has **not landed**. Until it does, Library's "Players" column, "Shortest session" sort,
  and the AI-pick stats all render `max_players=8` / `median_session_minutes=60` — dead
  schema defaults no code writes — and the recommender's groupFit+sessionFit (exactly
  50% of score weight) runs on them. The Steam appdetails response is already fetched and
  already contains the category data needed. Execute the locked plan; see the
  contracts in memory `project_news_appdetails_plan.md` (migration numbering, exact
  column names, the no-drop rule). Discards at `gameCatalogEnrichment.ts:7-16,256`.

- [ ] **Steam achievements surface (the Achievements pillar deserves it).** Per-user
  completion is already synced (24h cooldown, top-15 games by playtime) into
  `user_game_progress` (`035` migration), consumed only by the AI news curator. Add
  `GET /steam/crew-achievements` (aggregate over `user_game_progress` ⋈ `games` ⋈
  `guild_members`) + a themed grid: per-game crew completion bars, closest-race
  callouts, a 100% Club. Zero new Steam quota, zero AI cost. Sync writer:
  `steam.ts:451`; bump `ACHIEVEMENT_TOP_N` (`:329`) to widen coverage.

- [ ] **Sunday Tide Check — the weekly digest the homepage already promises.**
  `Home.tsx:1666` advertises "one weekly digest: who showed up, what got played,
  what's queued" on a dead button; the feature exists nowhere. All mechanical:
  attendance (`game_night_attendees`), what got played (`user_games.playtime_2weeks`),
  queued (upcoming `game_nights` + wishlist), highlights (`activity_events`). Add a
  weekly cron (copy `server.ts:147`), persist to a small table, push a `bot_announcements`
  row with a new `kind` (`tide.weekly`) — the bot poller safely ignores unknown kinds
  today (`apps/bot/src/index.ts:712`), so the branch is additive. Optional one cheap
  haiku call/week for a Nuggie intro. Wire "See last week's tide →" to a real page.

- [ ] **"Hot this week on the island" trending card.** `playtime_2weeks` is synced every
  5 min and seen by zero humans (AI-prompt context only). `GET /steam/crew-trending`
  (SUM `playtime_2weeks` per app across the crew ⋈ `games` for art, top 6) + a Home/Games
  card: game, total crew hours this fortnight, who's leading. Pure SQL, no AI, no new
  Steam calls. Sources: `user_games.playtime_2weeks` (`015`), written by `steam.ts:707`.

- [ ] **Wishlist sale radar via CheapShark.** The crew wishlist shows hype but no price,
  and the codebase already talks to CheapShark (image fallback only,
  `gameCatalogEnrichment.ts:18`). Daily cron, batch-query by `steamAppID` for the union
  of wishlisted apps (free API, no key), store price + discount, surface "ON SALE −60%"
  on the Group Wishlist card + a line in the Tide digest. **Coordinate column naming with
  the locked appdetails plan — `price_final_cents` is reserved at migration 045; use
  those names or number at 048+.**

- [ ] **Steam achievement unlocks in the activity feed.** Diff `achievements_unlocked`
  old-vs-new during the existing 24h sync (`steam.ts:451`) and record a new event
  (~20 lines, zero extra API calls). **Verified caveat:** the celebration overlay matches
  exact eventType strings for the current user only (`App.tsx:122`), so a new event type
  shows in the feed under the "achievements" category but **not** the overlay — decide
  deliberately whether Steam diffs should trigger confetti, and don't reuse the literal
  `achievement.unlocked` type (its overlay copy hardcodes "equip from the Milestones page").

- [ ] **Game detail drawer (after the appdetails build).** Wire the dead Library `DETAILS`
  button to a drawer: owners (crew-games), crew playtime, per-member achievement
  completion (`user_game_progress`), recent patch notes (`game_news` keyed by `app_id`).
  Also fix the PLAN half-promise by deep-linking the drawer into the Games composer with
  the game preselected. Turns Library from a table into a browsing destination.

- [ ] **Real islander profiles (bigger).** Replace the Community crew-card mock with
  `GET /members/:discordUserId/profile` (honoring `users.steam_visibility`): top games,
  recent activity, Nuggies rank tier, achievement showcase. Gives Friends Online + the
  crew carousel somewhere to click through to. Ingredients all synced already.

---

## P4 — Delight (make live features more fun)

- [ ] **Auto day/night from the real clock.** Scene defaults to night forever and the
  toggle is purely manual (`useDayNight.tsx:16`). Add an "auto" mode (new default) that
  picks day/night from local hour; keep the UserMenu toggle as a 3-way auto/day/night
  override in the same localStorage key. The Celestial dip/rise already animates any
  flip (`IslandSceneShell.tsx:129`), so this is near-zero animation work. Optional
  golden-hour gradient ~6-8pm.

- [ ] **Confetti for daily-claim and shop-buy.** The full emoji-confetti machine (🍗
  included) sits unused (`celebration.tsx:46`), reserved for achievements, while the
  most-repeated interaction — claiming daily Nuggies — rewards a static text swap
  (`Home.tsx:451,568`). Fire a card-scoped burst on claim and on Achievements shop buys
  (which today report success silently, errors via `alert()`, `Achievements.tsx:135`).
  Replace the hardcoded "Claim 75 Nuggies Today" label with the server-driven amount.

- [ ] **Mobile pass (known issue).** `Games.tsx:97` hard-codes a 1.4fr/1fr split with no
  breakpoint; the When/Where strip is fixed `1fr 1fr`; `Library.tsx:259` is a rigid
  6-column grid; the two palm frames are `minWidth:220` each (440px on a 380px phone,
  `IslandSceneShell.tsx:344`). Reuse the existing breakpoint pattern (`.bi-home-top`,
  `IslandSceneShell.tsx:672`): add `.bi-games-split`, collapse the Library row, and
  shrink/hide palms under ~720px.

- [ ] **Library PLAN actually plans.** PLAN promises "jump straight into planning" but
  just `onNavigate('games')` (`Library.tsx:246`). Thread a `planSeed` (appId) through App
  state: Games preselects the game's owners in the roster (the localStorage
  `selectedMemberIds` mechanism already re-fires the recommendation, `App.tsx:355`),
  scrolls to the composer, and toasts "Planning around Deep Rock — roster set to its 4
  owners."

- [ ] **Nuggie chat polish.** The live crew chat renders nothing until the first message
  and shows a static "Thinking…" (`Games.tsx:1644,1683`). Add a Nuggie-voice empty state,
  2-3 starter chips that **prefill** (not auto-send — no surprise AI spend), and bouncing
  typing dots. This is the one web surface where Nuggie voice is on-brand.

- [ ] **Toast glow-up.** Exit animation (slide-down + fade), tone icons (🌊 info / ✅
  success / 🪸 error), hover-to-pause, honor `prefers-reduced-motion`. Delete the dead
  "vote saved" entry from `SUCCESS_PREFIXES` (`toast.tsx:94`).

- [ ] **Time-aware hero greeting** + a real subline ("Game night tonight — 4 RSVPs" from
  a one-shot `GET /game-nights`). `Home.tsx:97`.

- [ ] **Seasonal / weather scene moments (config, not code).** December palm string-lights,
  late-October jack-o'-lantern moon, occasional shooting star, date-seeded overcast roll —
  all pure CSS/SVG in components that already exist (`Stars`/`Clouds`/`MoonDisc`/
  `PalmTreeSvg`), gated behind the existing reduced-motion block.

---

## Suggested execution order

1. **P0 blockers** — one evening, before anything goes public.
2. **P1 dead-chrome + ComingSoon + StreamDrawer + Steam unlink** — one evening; stops the
   UI lying.
3. **P2 #1–4** (code-split, member-sync cron, featured memo, crew-games background) — ~a day.
4. **P3 appdetails build** (the locked plan) — unblocks honest Library + recommender.
5. **P3 Tide Check + achievements surface + trending card** — the weekly-return hooks.
6. **P1 Community wiring + P4 delight batch** — polish.

Each P-tier is independently shippable. Re-verify any `file:line` before editing — this
plan is a 2026-06-10 snapshot.
