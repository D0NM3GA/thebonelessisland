PROJECT NAME: The Boneless Island

PROJECT TYPE:
Community web platform + Discord integration for a long-running gaming Discord server.

COMMUNITY CONTEXT:
- Discord server name: "The Boneless Island"
- Age: ~6 years
- Discord is the center of the community
- Goal is NOT to build a commercial product, but a useful, fun, long-lived community hub

CORE GOALS:
1. Build a website that people return to repeatedly
2. Use the site to solve real Discord problems (what to play, who's available, shared history)
3. Practice real, transferable engineering skills (auth, APIs, data modeling, UX, infra)
4. Preserve community memory, inside jokes, and identity
5. Keep everything opt-in, respectful, and playful (non-sweaty, non-corporate)

AUTHENTICATION & IDENTITY:
- Discord OAuth is the ONLY login method
- No passwords, no email accounts
- Discord user ID is the canonical user identifier
- Login is restricted to members of the configured Discord guild
- Steam is supported ONLY as an optional linked account AFTER Discord login

DISCORD DATA USED (minimal scope):
- Discord user ID, username, avatar
- Server membership, roles (optional)
- Voice channel presence + rich presence (read-only)

STEAM DATA USED (opt-in, read-only):
- SteamID64
- Owned games
- Wishlist (planned)
- Playtime / last played
- Public profile info

IDENTITY PHILOSOPHY:
- Discord = social identity
- Steam = game library reality
- All features should work without Steam, but Steam enhances them

INFORMATION ARCHITECTURE (current):
Top nav: Home · Games · Community · Achievements · Admin (gated to "Parent" role)
User menu (avatar dropdown): Discord profile + custom status + rich presence + status picker + theme toggle (Day/Night) + Profile + Sign out
Sub-pages: Games → Library; Admin hub → 9 sub-pages (News Curation, Recommendation Tester, Data Sync, Members & Roles, Game Night Moderation, Forum Moderation, Tournaments, Game Library, Audit Log)

CORE FEATURE PILLARS:

1. COMMUNITY HUB (HOME)
- Hero with day/night scene + parallax palms + sun-or-moon arc-dip on theme switch
- Featured Game card
- Friends Online widget (live Discord presence)
- Discord-style Activity Feed (friends/achievements/milestones/patches tabs)
- Drift Log news cards (curated patches/updates)
- Bot CTA + Crew ritual cards

2. GAMES (replaces voting flow)
- AI-recommended session composer:
  - AI pick header with match strength + reasoning
  - Mode bar (Tonight/Weekend/Quick/Cozy/Spicy)
  - Crew roster picker (live members) → invite list
  - When/Where strip
  - Send invite footer
- Patches & Updates rolodex (featured + filterable list)
- Scheduled game nights with RSVP (no voting)
- Group wishlist (pooled Steam wishlists with hype bars)
- Library snapshot → full Library sub-page
- Live streams drawer (right-edge tab)
**The voting mechanic is intentionally removed from the UI.** Hosts pick the game directly. Vote-related API endpoints remain alive for backwards compat but are no longer called from the web app.

3. LIBRARY (sub-page of Games)
- Steam library list with search, category filter chips, sort, co-ownership avatar stacks, PLAN shortcut

4. COMMUNITY
- Crew carousel (admin button gated to Parent)
- Recent clips & captures grid
- Activity timeline
- Forums table (channels)
- Clubs cards
- Upcoming events with date tiles + RSVP
- Weekly leaderboards

5. ACHIEVEMENTS (placeholder)
- Island-specific badges for attendance/participation/milestones
- No competitive pressure or grind

6. DISCORD + STEAM INTELLIGENCE (CORE VALUE)
PRIMARY PROBLEM TO SOLVE:
"Who can play what together right now?"
- Detect online Discord members
- Cross-reference Steam libraries
- Recommend games that everyone owns + fit group size + session length
- Surface best matches, near matches (one missing), dormant libraries

7. DISCORD INTEGRATION
- Thin Discord bot backed by website logic
- Slash commands: /whatcanweplay (live), more planned
- Future: automated weekly digest

8. ADMIN
- Hub of 9 tinted tiles → sub-pages
- Role-gated to Discord "Parent" role
- News curation, recommendation tester, data sync health, member roles, game-night mod, forum mod, tournaments, library overrides, audit log

VISUAL SYSTEM:
- Tropical sky/ocean/beach scene (full-bleed fixed background, z-index -10)
- Day/night themes:
  - Night = deep navy sky + stars + moon
  - Day = blue sky + clouds + sun
  - Toggle in user menu; sun/moon does an arc-dip transition (1.1s drop, 1.5s rise) during switch
- Palm trees frame the viewport (left + right SVG silhouettes with chunky trunks, rings clipped to trunk, 12 fronds, coconut cluster) with sway loop + scroll parallax (rise + scale + fade)
- Theme color tokens are CSS variables (`--bi-app-bg`, `--bi-panel-bg`, etc.) swapped via `:root[data-theme="day"]` so components stay token-driven
- Translucent glass panels (`backdrop-filter`) sit over the scene
- Fonts: Bricolage Grotesque (display), Inter (body), JetBrains Mono (mono)
- `.island-display` and `.island-mono` global utility classes available

DESIGN & TONE:
- Playful, self-aware, community-first
- Worldbuilding metaphors encouraged (island, shore, crew, dock, drift log, lagoon, reef)
- Avoid corporate or SaaS styling
- Features should feel like toys + tools, not dashboards

BRAND DETAILS (HIGH PRIORITY):
- Primary demographic is adult gamers (mostly men in their 30s) from the Discord community.
- Themed setting is a tropical island: beach, palms, sand, shoreline, warm-weather vibe.
- Core mascot identity is boneless chicken nuggets with personality (arms/legs/faces, often gaming).
- New copy, placeholder text, and visual concepts should reflect this identity by default.
- Keep tone fun and mature: playful without being juvenile, ironic without being cynical.

PRIVACY & TRUST:
- Everything opt-in
- Minimal permissions
- Clear explanation of what data is used and why
- Allow users to hide or remove linked accounts

IMPLEMENTATION GUIDANCE:
- Favor simple, composable data models
- Rule-based recommendations now; AI/LLM-driven recommendations planned (Games page is already designed around an AI pick affordance)
- Optimize for clarity, debuggability, and iteration
- Web styling: theme tokens in `apps/web/src/theme.ts` (CSS vars + palette + glass + motion + font + prose), primitives in `apps/web/src/islandUi.tsx`
- Day/night context lives in `apps/web/src/scene/useDayNight.tsx`
- Scene + palms + sky live in `apps/web/src/scene/IslandSceneShell.tsx`, mounted around `<App>` in `main.tsx`
- Default to shared themed components before creating one-off inline UI patterns
- Many activity/news/streams/wishlist/forum/club/event/leaderboard cards currently render mock data — wire to real API endpoints as backend grows

CURRENT STATE:
- React + Vite + TypeScript monorepo (`apps/web`, `apps/api`, `apps/bot`, `packages/shared`)
- Discord OAuth + guild gate working
- Steam linking + owned-games sync working
- Rule-based recommendation endpoint live
- Game night create/RSVP/finalize endpoints live (UI no longer surfaces voting)
- Design implementation: 8 phases shipped (foundation, topbar, home, games, library, community, admin, cleanup)

ASSISTANT EXPECTATIONS:
- Assume this is a long-lived project
- Do NOT over-scope features
- Bias toward maintainable, incremental solutions
- Explain architectural decisions briefly when relevant
- Ask clarifying questions ONLY if strictly necessary
