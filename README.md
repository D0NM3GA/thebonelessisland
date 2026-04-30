# The Boneless Island

Phase 1 starter workspace for a Discord-first community platform with optional Steam linking.

## What is included

- `apps/web`: React + Vite UI with login link and "what can we play?" view.
- `apps/api`: Express API with Discord OAuth, profile routes, Steam link/sync, and rule-based recommendations.
- `apps/bot`: Thin Discord bot exposing `/whatcanweplay` and delegating recommendation logic to the API.
- `packages/shared`: shared cross-app TypeScript types.
- `infra/docker-compose.yml`: local Postgres container.

## Data and privacy defaults

- Discord OAuth is the only sign-in method.
- Discord user ID is the canonical identity key.
- Steam linking is optional and can be removed by users.
- Steam data is used read-only for overlap/recommendation features.
- Recommendations API access is restricted to authenticated web sessions or trusted bot requests.
- No password or email account storage.

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
