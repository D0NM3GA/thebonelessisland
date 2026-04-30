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

const nightCommand = new SlashCommandBuilder()
  .setName("nightrecommend")
  .setDescription("Suggest games for a specific game night")
  .addIntegerOption((option) =>
    option.setName("nightid").setDescription("Game night ID from the website").setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("memberids")
      .setDescription("Optional override: comma-separated Discord member IDs (defaults to attendees/voters)")
      .setRequired(false)
  );

async function registerCommands() {
  if (!token || !clientId) return;
  const rest = new REST({ version: "10" }).setToken(token);
  const body = [command.toJSON(), nightCommand.toJSON()];

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log(`Registered commands for guild ${guildId}`);
      return;
    }
  } catch (error) {
    // Do not crash the bot if guild command registration fails (e.g. wrong guild id).
    console.error("Guild command registration failed, falling back to global registration", error);
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log("Registered global commands");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot ready as ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration failed", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "whatcanweplay" && interaction.commandName !== "nightrecommend") return;
  try {
    await interaction.deferReply();

    if (!botApiSharedSecret) {
      await interaction.editReply("BOT_API_SHARED_SECRET is missing; recommendations are locked until it is set.");
      return;
    }

    let response: Response;

    if (interaction.commandName === "whatcanweplay") {
      const memberIds = interaction.options
        .getString("memberids", true)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      response = await fetch(`${apiBase}/recommendations/what-can-we-play`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-island-bot-secret": botApiSharedSecret
        },
        body: JSON.stringify({ memberIds, sessionLength: "any", maxGroupSize: memberIds.length })
      });
    } else {
      const nightId = interaction.options.getInteger("nightid", true);
      const overrideMemberIds =
        interaction.options
          .getString("memberids", false)
          ?.split(",")
          .map((id) => id.trim())
          .filter(Boolean) ?? [];

      response = await fetch(`${apiBase}/game-nights/${nightId}/recommendations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-island-bot-secret": botApiSharedSecret
        },
        body: JSON.stringify({
          memberIds: overrideMemberIds.length ? overrideMemberIds : undefined,
          sessionLength: "any"
        })
      });
    }

    const data = (await response.json().catch(() => null)) as
      | {
          recommendations?: Array<{ name: string; reason: string; score: number }>;
          memberIds?: string[];
          error?: string;
        }
      | null;

    if (!response.ok) {
      const errorText = data?.error ?? `recommendation request failed (${response.status})`;
      await interaction.editReply(`Could not fetch recommendations: ${errorText}`);
      return;
    }

    const lines = (data?.recommendations ?? [])
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.name} (${r.reason}, score ${r.score})`);
    const audience =
      interaction.commandName === "nightrecommend" && data?.memberIds?.length
        ? `\nAudience: ${data.memberIds.join(", ")}`
        : "";
    await interaction.editReply(lines.length ? `${lines.join("\n")}${audience}` : `No matches right now.${audience}`);
  } catch (error) {
    console.error(`${interaction.commandName} command failed`, error);
    if (interaction.deferred || interaction.replied) {
      await interaction
        .editReply("Could not fetch recommendations right now. Please try again shortly.")
        .catch(() => undefined);
    }
  }
});

if (token) {
  client.login(token);
} else {
  console.log("DISCORD_BOT_TOKEN missing; bot not started.");
}
