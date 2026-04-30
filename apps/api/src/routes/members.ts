import express from "express";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { requireSession } from "../lib/auth.js";

type DiscordGuildMember = {
  nick?: string | null;
  roles?: string[];
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };
};

type DiscordRole = {
  id: string;
  name: string;
};

type DiscordVoiceState = {
  user_id?: string;
  channel_id?: string | null;
};

export const membersRouter = express.Router();
membersRouter.use(requireSession);

membersRouter.get("/", async (_req, res) => {
  if (!env.DISCORD_GUILD_ID) {
    res.status(400).json({ error: "DISCORD_GUILD_ID is not configured" });
    return;
  }

  const members = await db.query<{
    discord_user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role_names: string[];
    in_voice: boolean;
    rich_presence_text: string | null;
  }>(
    `
      SELECT discord_user_id, username, display_name, avatar_url, role_names, in_voice, rich_presence_text
      FROM guild_members
      WHERE guild_id = $1 AND in_guild = TRUE
      ORDER BY username ASC
      LIMIT 2000
    `,
    [env.DISCORD_GUILD_ID]
  );

  res.json({
    members: members.rows.map((row) => ({
      discordUserId: row.discord_user_id,
      username: row.username,
      displayName: row.display_name ?? row.username,
      avatarUrl: row.avatar_url,
      roleNames: row.role_names,
      inVoice: row.in_voice,
      richPresenceText: row.rich_presence_text
    }))
  });
});

membersRouter.post("/sync", async (_req, res) => {
  if (!env.DISCORD_GUILD_ID || !env.DISCORD_BOT_TOKEN) {
    res.status(400).json({ error: "DISCORD_GUILD_ID and DISCORD_BOT_TOKEN are required for member sync" });
    return;
  }

  const guildCheck = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
  });

  if (!guildCheck.ok) {
    const body = await guildCheck.text().catch(() => "");
    res.status(502).json({
      error: "Bot cannot access the configured Discord guild",
      details:
        body.slice(0, 300) ||
        "Verify DISCORD_GUILD_ID matches your server and that the bot is invited to that server."
    });
    return;
  }

  const response = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members?limit=1000`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const guidance =
      response.status === 403
        ? "Discord denied member list access. Enable Server Members Intent for this bot in Discord Developer Portal -> Bot, then restart the bot/API."
        : "";
    res.status(502).json({
      error: `Discord member sync failed (${response.status})`,
      details: `${body.slice(0, 300)} ${guidance}`.trim()
    });
    return;
  }

  const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/roles`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
  });
  const rolesPayload = rolesResponse.ok ? ((await rolesResponse.json()) as DiscordRole[]) : [];
  const roleNameById = new Map<string, string>(rolesPayload.map((role) => [role.id, role.name]));

  const voiceResponse = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/voice-states`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
  }).catch(() => null);
  const voiceStates = voiceResponse?.ok ? ((await voiceResponse.json()) as DiscordVoiceState[]) : [];
  const voiceChannelByUserId = new Map<string, string>();
  for (const state of voiceStates) {
    const userId = state.user_id?.trim();
    const channelId = state.channel_id?.trim();
    if (userId && channelId) {
      voiceChannelByUserId.set(userId, channelId);
    }
  }

  const data = (await response.json()) as DiscordGuildMember[];
  const normalized = data
    .map((member) => {
      const id = member.user?.id?.trim();
      const username = member.user?.username?.trim();
      if (!id || !username) return null;
      const avatar = member.user?.avatar ?? null;
      const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null;
      const displayName = member.nick?.trim() || member.user?.global_name?.trim() || username;
      const roleIds = (member.roles ?? []).filter(Boolean);
      const roleNames = roleIds.map((roleId) => roleNameById.get(roleId) ?? `role:${roleId}`);
      const voiceChannelId = voiceChannelByUserId.get(id) ?? null;
      const inVoice = Boolean(voiceChannelId);
      const richPresenceText = inVoice ? "In a voice channel" : "Offline or not in voice";
      return { id, username, displayName, avatarUrl, roleIds, roleNames, inVoice, voiceChannelId, richPresenceText };
    })
    .filter(
      (
        row
      ): row is {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        roleIds: string[];
        roleNames: string[];
        inVoice: boolean;
        voiceChannelId: string | null;
        richPresenceText: string;
      } => Boolean(row)
    );

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE guild_members SET in_guild = FALSE WHERE guild_id = $1`, [env.DISCORD_GUILD_ID]);

    for (const member of normalized) {
      await client.query(
        `
          INSERT INTO guild_members (
            guild_id,
            discord_user_id,
            username,
            display_name,
            avatar_url,
            role_ids,
            role_names,
            in_voice,
            voice_channel_id,
            rich_presence_text,
            in_guild,
            last_synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::text[], $7::text[], $8, $9, $10, TRUE, NOW())
          ON CONFLICT (guild_id, discord_user_id)
          DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            avatar_url = EXCLUDED.avatar_url,
            role_ids = EXCLUDED.role_ids,
            role_names = EXCLUDED.role_names,
            in_voice = EXCLUDED.in_voice,
            voice_channel_id = EXCLUDED.voice_channel_id,
            rich_presence_text = EXCLUDED.rich_presence_text,
            in_guild = TRUE,
            last_synced_at = NOW()
        `,
        [
          env.DISCORD_GUILD_ID,
          member.id,
          member.username,
          member.displayName,
          member.avatarUrl,
          member.roleIds,
          member.roleNames,
          member.inVoice,
          member.voiceChannelId,
          member.richPresenceText
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  res.json({ syncedMembers: normalized.length });
});
