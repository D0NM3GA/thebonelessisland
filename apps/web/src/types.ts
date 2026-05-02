export type PageId =
  | "home"
  | "games"
  | "library"
  | "community"
  | "achievements"
  | "profile"
  | "admin";

export type Recommendation = {
  appId: number;
  name: string;
  owners: number;
  nearMatchMissingMembers: number;
  score: number;
  reason: string;
  blurb?: string;
};

export type GameNight = {
  id: number;
  title: string;
  scheduledFor: string;
  createdByUserId: number;
  topGameName: string | null;
  topGameVote: number | null;
  selectedGameName: string | null;
  selectedAppId: number | null;
  selectedAt: string | null;
  attendeeCount: number;
  currentUserAttending: boolean;
};

export type GameNightAttendee = {
  discordUserId: string;
  username: string;
};

export type GuildMember = {
  discordUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roleNames: string[];
  inVoice: boolean;
  richPresenceText: string | null;
};

export type MeProfile = {
  discordUserId: string;
  steamVisibility: "private" | "members" | "public";
  featureOptIn: boolean;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  steamId64: string | null;
  steamLastSyncedAt: string | null;
  roleNames: string[];
  inVoice: boolean;
  richPresenceText: string;
};

export type OwnedGameLite = {
  appId: number;
  name: string;
};

export type CrewOwner = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type CrewOwnedGame = {
  appId: number;
  name: string;
  maxPlayers: number;
  medianSessionMinutes: number;
  developers: string[];
  tags: string[];
  headerImageUrl: string | null;
  ownerCount: number;
  owners: CrewOwner[];
};

export type CrewWishlistGame = {
  appId: number;
  name: string;
  maxPlayers: number;
  medianSessionMinutes: number;
  developers: string[];
  tags: string[];
  headerImageUrl: string | null;
  hypeCount: number;
  earliestAddedAt: string | null;
  wishlistedBy: CrewOwner[];
};

export type FeaturedRecommendationScope = "voice" | "crew";

export type FeaturedRecommendation = {
  appId: number;
  name: string;
  owners: number;
  scopeMemberCount: number;
  score: number;
  reason: string;
  headerImageUrl: string | null;
  tags: string[];
  maxPlayers: number | null;
  medianSessionMinutes: number | null;
};

export type FeaturedRecommendationResponse = {
  featured: FeaturedRecommendation | null;
  scope: FeaturedRecommendationScope;
  scopeMemberCount: number;
};

export type GameNewsScope = "library" | "wishlist" | "crew";

export type GameNewsItem = {
  appId: number;
  gameName: string;
  headerImageUrl: string | null;
  gid: string;
  title: string;
  url: string;
  contents: string | null;
  feedLabel: string | null;
  feedName: string | null;
  feedType: number | null;
  isExternalUrl: boolean;
  author: string | null;
  tags: string[];
  publishedAt: string;
  scopes: GameNewsScope[];
  aiRelevanceScore?: number | null;
  aiSummary?: string | null;
  aiLabel?: "personal" | "community" | "top_news" | null;
  aiSpoilerWarning?: boolean;
};

export type GeneralNewsItem = {
  id: number;
  sourceType: "rss" | "newsapi";
  sourceName: string;
  externalId: string;
  title: string;
  url: string;
  contents: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string;
  matchedTags: string[];
  aiRelevanceScore: number | null;
  aiSummary: string | null;
  aiLabel: "top_news" | "community" | "personal" | null;
  aiSpoilerWarning: boolean;
};

export type ActivityCategory = "all" | "friends" | "achievements" | "milestones" | "patches";

export type ActivityActor = {
  discordUserId: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type ActivityEvent = {
  id: string;
  eventType: string;
  category: ActivityCategory;
  createdAt: string;
  actor: ActivityActor | null;
  target: ActivityActor | null;
  game: { appId: number; name: string; headerImageUrl: string | null } | null;
  gameNightId: string | null;
  payload: Record<string, unknown>;
};

export type NewsCard = {
  id: string;
  title: string;
  body: string;
  icon: string;
  tag: string | null;
  sourceUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  createdBy: ActivityActor | null;
};

export type ServerSetting = {
  key: string;
  value: string;
  label: string;
  description: string | null;
  isSecret: boolean;
  envDefault: string;
  updatedAt: string;
};
