PROJECT NAME: The Boneless Island

PROJECT TYPE:
Community web platform + Discord integration for a long-running gaming Discord server.

COMMUNITY CONTEXT:
- Discord server name: "The Boneless Island"
- Age: ~6 years
- Discord is the center of the community
- There is currently no website or external tooling
- Goal is NOT to build a commercial product, but a useful, fun, long-lived community hub

CORE GOALS:
1. Build a website that people return to repeatedly
2. Use the site to solve real Discord problems (what to play, who’s available, shared history)
3. Practice real, transferable engineering skills (auth, APIs, data modeling, UX, infra)
4. Preserve community memory, inside jokes, and identity
5. Keep everything opt-in, respectful, and playful (non-sweaty, non-corporate)

AUTHENTICATION & IDENTITY:
- Discord OAuth is the ONLY login method
- No passwords, no email accounts
- Discord user ID is the canonical user identifier
- Steam is supported ONLY as an optional linked account AFTER Discord login

DISCORD DATA USED (minimal scope):
- Discord user ID
- Username and avatar
- Server membership
- Roles (optional)
- Presence / online status (optional, read-only)

STEAM DATA USED (opt-in, read-only):
- SteamID64
- Owned games
- Wishlist
- Playtime / last played
- Public profile info

IDENTITY PHILOSOPHY:
- Discord = social identity
- Steam = game library reality
- All features should work without Steam, but Steam enhances them

CORE FEATURE PILLARS:

1. COMMUNITY HUB (WEBSITE HOME)
- Landing page showing live or semi-live community data
- Online members
- Upcoming or recent game nights
- Recent activity or highlights
- Serves as the "front door" to The Boneless Island

2. MEMBER PROFILES ("ISLAND CITIZENS")
- Created automatically on first Discord login
- Persistent identity even if usernames change
- Shows:
  - Discord profile info
  - Join date
  - Roles / badges
  - Linked Steam profile (if opted in)
- All visibility options are opt-in

3. LORE & COMMUNITY MEMORY
- Inside-joke / lore wiki
- Historical events, memes, legendary moments
- Game night history:
  - What was played
  - Who attended
  - Optional screenshots/clips
- Goal: turn ephemeral Discord chat into shared long-term memory

4. DISCORD + STEAM INTELLIGENCE (CORE VALUE)

PRIMARY PROBLEM TO SOLVE:
"Who can play what together right now?"

CORE FEATURES:
- Detect online Discord members
- Cross-reference Steam libraries
- Recommend games that:
  - Everyone owns
  - Support the current group size
  - Respect session length (short vs long)
- Surface:
  - Best matches
  - Near matches (one person missing)
  - Games owned by many but never played

SECONDARY INTELLIGENCE FEATURES:
- Detect frequent co-players and groups
- Suggest people who share many unused overlaps
- Identify dormant libraries ("everyone owns this, nobody plays it")
- Nudge variety when games are overplayed

5. WISHLIST-DRIVEN FEATURES
- Group wishlist overlap
- Threshold alerts ("2 more people need to buy this")
- Sale alerts with social context
  (e.g. "6 Island members want this and it’s on sale")

6. DISCORD INTEGRATION
- Thin Discord bot backed by website logic
- Slash commands like:
  - /whatcanweplay
  - /whowns <game>
  - /wishlist-overlap
- Automated weekly or monthly Discord posts that link back to the site

7. GAMIFICATION (LIGHT, OPTIONAL)
- Community achievements (Island-specific, not Steam achievements)
- Badges for attendance, participation, milestones
- Absolutely no competitive pressure or grind

DESIGN & TONE:
- Playful, self-aware, community-first
- Worldbuilding metaphors encouraged (Island, regions, citizens)
- Avoid corporate or SaaS styling
- Features should feel like toys + tools, not dashboards

PRIVACY & TRUST:
- Everything opt-in
- Minimal permissions
- Clear explanation of what data is used and why
- Allow users to hide or remove linked accounts

IMPLEMENTATION GUIDANCE:
- Favor simple, composable data models
- Start rule-based for recommendations (no ML initially)
- Optimize for clarity, debuggability, and iteration
- Build Phase 1 small but foundational

RECOMMENDED PHASE 1 SCOPE:
- Discord OAuth login
- User profiles
- Steam account linking
- "What can we play together tonight?" feature
- Basic game night planning/voting

ASSISTANT EXPECTATIONS:
- Assume this is a long-lived project
- Do NOT over-scope features
- Bias toward maintainable, incremental solutions
- Explain architectural decisions briefly when relevant
- Ask clarifying questions ONLY if strictly necessary