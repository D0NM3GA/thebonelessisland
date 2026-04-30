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
- Refresh activity in the UI (or call `POST /members/sync`) to update member/voice data.
- Voice status is resolved by per-user Discord voice state lookups:
  - `GET /guilds/{guildId}/voice-states/{userId}`
- If a user is not in voice, Discord returns `404` for that user, which is treated as normal.

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
