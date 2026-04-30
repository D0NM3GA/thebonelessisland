import dotenv from "dotenv";
import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

dotenv.config({ path: "../../.env" });

const token = process.env.DISCORD_BOT_TOKEN ?? "";
const clientId = process.env.DISCORD_BOT_CLIENT_ID ?? "";
const guildId = process.env.DISCORD_GUILD_ID ?? "";
const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000";
const botApiSharedSecret = process.env.BOT_API_SHARED_SECRET ?? "";

const command = new SlashCommandBuilder()
  .setName("whatcanweplay")
  .setDescription("Suggest games this group can play now")
  .addStringOption((option) =>
    option.setName("memberids").setDescription("Comma-separated Discord member IDs").setRequired(true)
  );

async function registerCommands() {
  if (!token || !clientId || !guildId) return;
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [command.toJSON()] });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot ready as ${readyClient.user.tag}`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "whatcanweplay") return;
  await interaction.deferReply();

  if (!botApiSharedSecret) {
    await interaction.editReply("BOT_API_SHARED_SECRET is missing; recommendations are locked until it is set.");
    return;
  }

  const memberIds = interaction.options
    .getString("memberids", true)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  try {
    const response = await fetch(`${apiBase}/recommendations/what-can-we-play`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-island-bot-secret": botApiSharedSecret
      },
      body: JSON.stringify({ memberIds, sessionLength: "any", maxGroupSize: memberIds.length })
    });

    const data = (await response.json().catch(() => null)) as
      | { recommendations?: Array<{ name: string; reason: string; score: number }>; error?: string }
      | null;

    if (!response.ok) {
      const errorText = data?.error ?? `recommendation request failed (${response.status})`;
      await interaction.editReply(`Could not fetch recommendations: ${errorText}`);
      return;
    }

    const lines = (data?.recommendations ?? [])
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.name} (${r.reason}, score ${r.score})`);
    await interaction.editReply(lines.length ? lines.join("\n") : "No matches right now.");
  } catch (error) {
    console.error("whatcanweplay command failed", error);
    await interaction.editReply("Could not fetch recommendations right now. Please try again shortly.");
  }
});

if (token) {
  client.login(token);
} else {
  console.log("DISCORD_BOT_TOKEN missing; bot not started.");
}
