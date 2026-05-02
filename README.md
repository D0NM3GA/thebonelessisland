# The Boneless Island

Discord-first community web platform with optional Steam linking. Tropical island theme, day/night themes, parallax palms, AI-driven session planning.

## What is included

- `apps/web`: React + Vite + TypeScript. Fixed topbar (Home / Games / Community / Achievements / Admin), Discord-style user menu, full-bleed scene shell (sky + sun/moon + ocean + beach + parallax palms), day/night theme switch.
- `apps/api`: Express API with Discord OAuth, profile routes, Steam link/sync, rule-based recommendations, game-night CRUD + RSVP.
- `apps/bot`: Thin Discord bot exposing `/whatcanweplay` and delegating recommendation logic to the API.
- `packages/shared`: shared cross-app TypeScript types.
- `infra/docker-compose.yml`: local Postgres container.

## Data and privacy defaults

- Discord OAuth is the only sign-in method.
- Discord user ID is the canonical identity key.
- Login is restricted to members of the configured Discord guild (`DISCORD_GUILD_ID`).
- Steam linking is optional and can be removed by users. Linking is done via the official Steam OpenID 2.0 flow ("Sign in through Steam"); we never ask for or store Steam credentials.
- Steam data is used read-only for overlap/recommendation features.
- Recommendations API access is restricted to authenticated web sessions or trusted bot requests.
- No password or email account storage.

## Authentication behavior

- The web app shows a login landing page for unauthenticated visitors.
- Users authenticate via `GET /auth/discord/login`.
- OAuth callback enforces guild membership by checking:
  - `GET https://discord.com/api/users/@me/guilds/{DISCORD_GUILD_ID}/member`
- Non-members are redirected back to the web app with an auth error state.

## Local setup

1. Copy `.env.example` to `.env` and fill required Discord/Bot/Steam values.
   - Set `BOT_API_SHARED_SECRET` to the same value for both API and bot runtime.
2. Start Postgres:
   - `docker compose -f infra/docker-compose.yml up -d`
3. Install dependencies:
   - `npm install`
4. Run DB migration:
   - `npm run db:migrate -w @island/api`
5. Start all services:
   - `npm run dev`

Web app: `http://localhost:5173`
API health: `http://localhost:3000/health`

`VITE_API_BASE_URL` (web) defaults to `http://localhost:3000`. Vite is locked to port 5173 (`strictPort`) and reads env from the repo root via `envDir: "../../"`.

## Information architecture

Top nav (fixed topbar with backdrop blur — `position: fixed` so it stays anchored during overscroll/rubber-band):
- **Home** — hero with online count + display headline + CTAs, Featured Game card, Friends Online widget (live Discord presence), Discord-style Activity Feed (5-tab filter), Drift Log news cards, Bot CTA + Crew Ritual cards
- **Games** — AI session composer (combined AI pick + crew roster + invite), Patches & Updates rolodex (sticky right column), scheduled game nights with RSVP, group wishlist with hype bars, library snapshot, live streams drawer (right-edge tab)
- **Community** — crew carousel (admin button gated to Parent), recent clips, activity timeline, forums table, clubs, upcoming events, weekly leaderboards
- **Achievements** — placeholder
- **Admin** — hub of 9 tinted tiles + 9 sub-pages (News Curation, Recommendation Tester, Data Sync, Members & Roles, Game Night Moderation, Forum Moderation, Tournaments, Game Library, Audit Log). Gated to Parent role.

User menu (avatar dropdown): Discord profile + custom status + rich presence + status picker + theme toggle (Day / Night) + Profile + Sign out.

## Member activity and voice status

- "Friends online" pulls from synced snapshots in `guild_members`.
- The web app auto-syncs profile/member/game-night data in the background for live updates.
- `POST /members/sync` can still be called directly for operational/manual sync workflows.
- Voice status is resolved by per-user Discord voice state lookups (`GET /guilds/{guildId}/voice-states/{userId}`).
- If a user is not in voice, Discord returns `404` for that user, which is treated as normal.

## Game image sourcing

- Game image enrichment is modularized in `apps/api/src/lib/gameCatalogEnrichment.ts`.
- Image provider order is declarative via `GAME_IMAGE_PROVIDER_PRIORITY`.
- Current provider chain: `steam -> cheapshark -> igdb` (IGDB scaffolded and disabled by default).
- Game metadata stores image provenance/check fields (`header_image_provider`, `header_image_checked_at`).
- Optional IGDB fallback envs: `IGDB_IMAGE_FALLBACK_ENABLED`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`.

## Game nights — voting mechanic removed

The voting flow that previously surfaced game blades + Hype/Maybe/Skip is **intentionally removed from the UI**. The new flow:
- Hosts schedule a night and pick the game directly (or accept the AI recommendation).
- Crew RSVPs to lock a seat.
- The AI session composer (Games page) surfaces a recommended pick with reasoning, mode chips (Tonight/Weekend/Quick/Cozy/Spicy), crew roster, when/where, and a Send invite footer.

Vote-related API endpoints (`/game-nights/:id/votes`, `/finalize`) remain alive on the API for backwards compat but are no longer called from the web app.

## UI design system

- Theme tokens + shared copy: `apps/web/src/theme.ts` (CSS variables + tropical palette + glass + motion + font + prose).
- Reusable themed primitives: `apps/web/src/islandUi.tsx`.
- Scene shell + day/night context: `apps/web/src/scene/`.
- Brand and design guidance: `STYLE_GUIDE.md`.
- Cursor project rules for persistent style behavior: `.cursor/rules/`.

### Visual system

- Full-bleed sky → ocean → beach scene fixed behind content (z-index -10).
- Day mode: blue sky + white clouds + sun.
- Night mode: navy sky + stars + moon.
- Sun/moon arc-dip transition during theme switch (1.1s drop, 1.5s rise).
- Palm trees (left + right SVG silhouettes) sway with wind loops, rise + scale + fade as you scroll past the hero.
- Translucent glass panels over the scene via `backdrop-filter`.
- Fonts: Bricolage Grotesque (display), Inter (body), JetBrains Mono (mono).
- Honors `prefers-reduced-motion`.

## Phase 1 feature coverage (backend / API)

- Discord OAuth login + session cookie auth.
- Auto-create user/profile on first login.
- Profile read/update endpoint with safe preference fields. `/profile/me` now exposes `steamLastSyncedAt` so the UI can show a live sync timestamp.
- Steam linking via official Steam OpenID 2.0:
  - `GET /steam/openid/start` redirects to `https://steamcommunity.com/openid/login`.
  - `GET /steam/openid/return` performs the `check_authentication` round trip, extracts SteamID64 from `openid.claimed_id`, upserts `steam_links`, fires a `steam.linked` activity event, and bounces back to the web app with `?steam=linked`.
  - Falls back to `?steam=error&steamReason=...` for cancelled / verification-failed / not-authenticated cases.
- Steam owned-games + wishlist sync (`POST /steam/sync-owned-games`, `POST /steam/sync-wishlist`).
- Rule-based recommendation endpoint:
  - exact overlaps
  - near matches (one missing owner)
  - scored ranking based on ownership, group fit, session length
  - protected access (logged-in user session or bot shared secret header)
- Featured recommendation endpoint (`GET /recommendations/featured`):
  - powers the Home Featured Game card
  - resolves scope to `voice` (members in voice) → falls back to `crew` (full guild)
  - enriches the top pick with header image / tags / player count / session length
- Crew library endpoint (`GET /steam/crew-games`):
  - powers the Library page and the AI session composer cover art
  - aggregates owners across the guild with display name + avatar URL
  - on-demand metadata + image enrichment for sparse rows
- Steam wishlist sync (`POST /steam/sync-wishlist`):
  - reads `IWishlistService/GetWishlist` for the linked Steam account
  - upserts `user_wishlists`, prunes removed entries, enriches missing names + covers
  - chained automatically after `POST /steam/sync-owned-games` (best-effort; private wishlists skip silently)
- Crew wishlist endpoint (`GET /steam/crew-wishlist`):
  - powers the Group Wishlist card on the Games page
  - aggregates pooled wishlists with hype count + earliest add date + crew avatars
- Game news endpoint (`GET /games/news`):
  - powers the Games page Patches & Updates rolodex
  - lazily ingests Steam News for the most relevant crew-owned apps (6h staleness window)
  - tags each item with `library` / `wishlist` / `crew` scopes for client-side filtering
- Activity ledger (`activity_events` + `GET /activity`):
  - emitted by game-night creates / RSVPs / picks and Steam link / unlink / sync
  - powers Home page Activity Feed and Community activity timeline
  - server-side category mapping (`friends` / `achievements` / `milestones` / `patches`)
- News cards (`GET /news-cards`, Parent-only `POST/PATCH/DELETE`):
  - powers Home page Drift Log
  - admin CRUD lives in Admin → News Curation; gated by `requireParentRole` middleware (`PARENT_ROLE_NAME` env var, defaults to `Parent`)
- Discord slash command `/whatcanweplay` calling the API endpoint.

## Front-end implementation status

The full Boneless Island design (handoff bundle from Claude Design) has been ported across 8 phases:

1. **Foundation** — fonts, day/night theme switch, sun/moon arc-dip, stars + clouds, richer palm SVGs, scroll parallax, theme CSS variables.
2. **Topbar + IA** — sticky topbar with brand mark + nav + search + admin pill + user menu trigger; Discord-style user menu.
3. **Home redesign** — hero, featured game, friends online, activity feed, drift log, bot/ritual CTAs.
4. **Games rebuild** — AI session composer, patches rolodex, scheduled nights, group wishlist, library snapshot, live streams drawer. Voting UI removed.
5. **Library** — full Steam library page with filters, sort, co-ownership stacks.
6. **Community** — crew carousel, clips, activity, forums, clubs, events, leaderboards.
7. **Admin** — hub + 9 sub-pages.
8. **Polish + parity** — voting state cleanup; App.tsx down 62%.

**Wired to real data**: Topbar profile + **Steam status badge** (logo + sync indicator next to the avatar), **Steam onboarding modal** (post-login prompt with Steam-branded "Sign in through Steam" button + tiny "no thanks, skip for now" link, dismissal persisted per-user in `localStorage`), **User-menu Steam panel** (Steam logo, "Synced 5m ago" / "Not linked" status, ID, Sync now / Sign in through Steam buttons), Home Friends Online widget, **Home Featured Game card** (top crew-overlap pick from `/recommendations/featured`), **Home Activity Feed** (live `activity_events` ledger from game-night + Steam emitters), **Home Drift Log** (Parent-curated news cards via `/news-cards`), **Games AI session composer** (real recommendation for the selected crew, falls back to the featured pick), **Games Patches & Updates rolodex** (live Steam News for crew-owned + wishlisted apps via `/games/news`), **Games Group Wishlist** (pooled crew wishlists from `/steam/crew-wishlist` with real cover art + hype bar), **Library page** (full crew library from `/steam/crew-games` with real owner avatars + per-game `★ MINE` badge), **Community activity timeline** (same `/activity` ledger), **Admin → News Curation** (full CRUD for drift-log cards), Games scheduled-nights cards + RSVP, Profile (Steam link visibility + owned-games exclusions).

**Still mock for now**: live streams drawer, Community crew carousel + clips + forums + clubs + events + leaderboards, most Admin sub-pages outside News Curation. These need new ingestion pipelines (Twitch API, clips storage, forum schema) and will land incrementally.
