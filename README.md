# The Boneless Island

Phase 1 starter workspace for a Discord-first community platform with optional Steam linking.

## What is included

- `apps/web`: React + Vite UI with Discord login landing gate, game-night planning flows, and themed UI primitives.
- `apps/api`: Express API with Discord OAuth, profile routes, Steam link/sync, and rule-based recommendations.
- `apps/bot`: Thin Discord bot exposing `/whatcanweplay` and delegating recommendation logic to the API.
- `packages/shared`: shared cross-app TypeScript types.
- `infra/docker-compose.yml`: local Postgres container.

## Data and privacy defaults

- Discord OAuth is the only sign-in method.
- Discord user ID is the canonical identity key.
- Login is restricted to members of the configured Discord guild (`DISCORD_GUILD_ID`).
- Steam linking is optional and can be removed by users.
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

## Member activity and voice status

- "Who's active in Discord right now" is based on synced snapshots in `guild_members`.
- The web app now auto-syncs profile/member/game-night data in the background for live updates.
- `POST /members/sync` can still be called directly for operational/manual sync workflows.
- Voice status is resolved by per-user Discord voice state lookups:
  - `GET /guilds/{guildId}/voice-states/{userId}`
- If a user is not in voice, Discord returns `404` for that user, which is treated as normal.

## Game image sourcing

- Game image enrichment is modularized in `apps/api/src/lib/gameCatalogEnrichment.ts`.
- Image provider order is declarative via `GAME_IMAGE_PROVIDER_PRIORITY`.
- Current provider chain: `steam -> cheapshark -> igdb` (IGDB scaffolded and disabled by default).
- Game metadata now stores image provenance/check fields:
  - `header_image_provider`
  - `header_image_checked_at`
- New env vars for optional IGDB fallback:
  - `IGDB_IMAGE_FALLBACK_ENABLED`
  - `IGDB_CLIENT_ID`
  - `IGDB_CLIENT_SECRET`

## Game night voting UX

- Voting UI uses compact interactive "game blades" optimized for long lists.
- Votes can be cast inline per game blade (`Hype +1`, `Maybe 0`, `Skip -1`) with optimistic updates.
- Per-user vote state is shown directly on each game blade and in vote totals.
- Vote list supports:
  - search
  - sort modes (`Top voted`, `Most owned`, `A-Z`)
  - optional grouping by primary game tag with collapsible sections
- Keyboard shortcuts on the vote list:
  - `ArrowUp` / `ArrowDown` to move selected game
  - `1` = `Hype +1`
  - `2` = `Maybe 0`
  - `3` = `Skip -1`

## UI design system

- Theme tokens and shared copy live in `apps/web/src/theme.ts`.
- Reusable themed primitives live in `apps/web/src/islandUi.tsx`.
- Brand and design guidance lives in `STYLE_GUIDE.md`.
- Cursor project rules for persistent style behavior live in `.cursor/rules/`.

## Phase 1 feature coverage

- Discord OAuth login + session cookie auth.
- Auto-create user/profile on first login.
- Profile read/update endpoint with safe preference fields.
- Steam link/unlink + owned games sync.
- Rule-based recommendation endpoint:
  - exact overlaps
  - near matches (one missing owner)
  - scored ranking based on ownership, group fit, session length
  - protected access (logged-in user session or bot shared secret header)
- Discord slash command `/whatcanweplay` calling the API endpoint.
