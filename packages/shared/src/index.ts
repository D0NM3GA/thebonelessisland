export type DiscordIdentity = {
  discordUserId: string;
  username: string;
  avatarUrl: string | null;
};

export type SteamLink = {
  steamId64: string;
  visibility: "private" | "members" | "public";
};

export type RecommendationInput = {
  memberIds: string[];
  sessionLength: "short" | "long" | "any";
  maxGroupSize: number;
};

export type RecommendedGame = {
  appId: number;
  name: string;
  owners: number;
  selectedMembers: number;
  nearMatchMissingMembers: number;
  score: number;
  reason: string;
};
