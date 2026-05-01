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
  roleNames: string[];
  inVoice: boolean;
  richPresenceText: string;
};

export type OwnedGameLite = {
  appId: number;
  name: string;
};
