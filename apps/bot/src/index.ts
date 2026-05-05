import dotenv from "dotenv";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import {
  BlackjackGame,
  calculatePayout,
  dealerPlay,
  formatHand,
  handTotal,
  hitPlayer,
  resolveGame,
  resultEmoji,
  startBlackjack,
} from "./blackjack.js";

dotenv.config({ path: "../../.env" });

const token = process.env.DISCORD_BOT_TOKEN ?? "";
const clientId = process.env.DISCORD_BOT_CLIENT_ID ?? "";
const guildId = process.env.DISCORD_GUILD_ID ?? "";
const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000";
const botApiSharedSecret = process.env.BOT_API_SHARED_SECRET ?? "";

// ── Active game state (in-memory) ─────────────────────────────────────────────

const activeBlackjackGames = new Map<string, BlackjackGame>();

// ── API Helper ────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  discordUserId: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-island-bot-secret": botApiSharedSecret,
      "x-discord-user-id": discordUserId,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function nuggie(n: number): string {
  return `**₦${n.toLocaleString()}**`;
}

// ── Command Definitions ───────────────────────────────────────────────────────

const commands = [
  // Existing
  new SlashCommandBuilder()
    .setName("whatcanweplay")
    .setDescription("Suggest games this group can play now")
    .addStringOption((o) =>
      o.setName("memberids").setDescription("Comma-separated Discord member IDs").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("nightrecommend")
    .setDescription("Suggest games for a specific game night")
    .addIntegerOption((o) =>
      o.setName("nightid").setDescription("Game night ID from the website").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("memberids").setDescription("Optional: comma-separated Discord member IDs").setRequired(false)
    ),

  // Nuggies core
  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily Nuggies 🍗"),

  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your Nuggies balance (or another member's)")
    .addUserOption((o) => o.setName("user").setDescription("Member to check").setRequired(false)),

  new SlashCommandBuilder()
    .setName("give")
    .setDescription("Send Nuggies to another member (5% fee applies)")
    .addUserOption((o) => o.setName("user").setDescription("Recipient").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("How many Nuggies to send").setRequired(true).setMinValue(1)
    ),

  // Shop & inventory
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse the Nuggies shop 🛒"),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buy an item from the shop")
    .addStringOption((o) => o.setName("item").setDescription("Item name").setRequired(true)),

  new SlashCommandBuilder()
    .setName("equip")
    .setDescription("Equip or unequip an item you own")
    .addStringOption((o) => o.setName("item").setDescription("Item name").setRequired(true)),

  // Games
  new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin — 1.9× payout on a win 🪙")
    .addIntegerOption((o) =>
      o.setName("bet").setDescription("Amount to bet").setRequired(true).setMinValue(1)
    )
    .addStringOption((o) =>
      o.setName("call").setDescription("heads or tails").setRequired(true)
        .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })
    ),

  new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play blackjack against the dealer 🃏")
    .addIntegerOption((o) =>
      o.setName("bet").setDescription("Amount to bet").setRequired(true).setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("guessnumber")
    .setDescription("Pick a number 1–10. Correct guess = 8× payout 🎯")
    .addIntegerOption((o) =>
      o.setName("bet").setDescription("Amount to bet").setRequired(true).setMinValue(1)
    ),

  // Loans
  new SlashCommandBuilder()
    .setName("loan")
    .setDescription("Nuggies loan system")
    .addSubcommand((s) =>
      s.setName("offer")
        .setDescription("Offer a loan to another member")
        .addUserOption((o) => o.setName("borrower").setDescription("Who to lend to").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("Principal amount").setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName("days").setDescription("Repayment window in days (max 7)").setRequired(false))
        .addIntegerOption((o) => o.setName("interest").setDescription("Interest % (default from server settings)").setRequired(false))
        .addIntegerOption((o) => o.setName("collateral").setDescription("Required collateral from borrower").setRequired(false).setMinValue(0))
    )
    .addSubcommand((s) =>
      s.setName("accept")
        .setDescription("Accept a pending loan offer")
        .addIntegerOption((o) => o.setName("id").setDescription("Loan ID").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("repay")
        .setDescription("Repay an active loan")
        .addIntegerOption((o) => o.setName("id").setDescription("Loan ID").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("cancel")
        .setDescription("Cancel a pending loan offer (lender only)")
        .addIntegerOption((o) => o.setName("id").setDescription("Loan ID").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("list")
        .setDescription("View your active loans")
    ),

  // Marketplace
  new SlashCommandBuilder()
    .setName("market")
    .setDescription("Nuggies marketplace")
    .addSubcommand((s) =>
      s.setName("list")
        .setDescription("List one of your items for sale")
        .addStringOption((o) => o.setName("item").setDescription("Item name to sell").setRequired(true))
        .addIntegerOption((o) => o.setName("price").setDescription("Asking price in Nuggies").setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName("buy")
        .setDescription("Buy a marketplace listing")
        .addIntegerOption((o) => o.setName("id").setDescription("Listing ID").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("browse")
        .setDescription("Browse active marketplace listings")
    )
    .addSubcommand((s) =>
      s.setName("cancel")
        .setDescription("Cancel your own listing")
        .addIntegerOption((o) => o.setName("id").setDescription("Listing ID").setRequired(true))
    ),

  // Opt out/in
  new SlashCommandBuilder()
    .setName("nuggies-opt-out")
    .setDescription("Opt out of the Nuggies economy (hides balance, blocks earning/spending)"),

  new SlashCommandBuilder()
    .setName("nuggies-opt-in")
    .setDescription("Opt back in to the Nuggies economy"),
];

// ── Register Commands ─────────────────────────────────────────────────────────

async function registerCommands() {
  if (!token || !clientId) return;
  const rest = new REST({ version: "10" }).setToken(token);
  const body = commands.map((c) => c.toJSON());
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log(`Registered ${body.length} commands for guild ${guildId}`);
      return;
    }
  } catch (error) {
    console.error("Guild command registration failed, falling back to global", error);
  }
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`Registered ${body.length} global commands`);
}

// ── Client ────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot ready as ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration failed", error);
  }
});

// ── Interaction Handler ───────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    switch (interaction.commandName) {

      // ── Existing recommendation commands ──────────────────────────────────

      case "whatcanweplay": {
        await interaction.deferReply();
        if (!botApiSharedSecret) {
          await interaction.editReply("BOT_API_SHARED_SECRET missing.");
          return;
        }
        const memberIds = interaction.options.getString("memberids", true)
          .split(",").map((id) => id.trim()).filter(Boolean);
        const res = await fetch(`${apiBase}/recommendations/what-can-we-play`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-island-bot-secret": botApiSharedSecret },
          body: JSON.stringify({ memberIds, sessionLength: "any", maxGroupSize: memberIds.length })
        });
        const data = await res.json().catch(() => null) as { recommendations?: Array<{ name: string; reason: string; score: number }>; error?: string } | null;
        if (!res.ok) { await interaction.editReply(`Error: ${data?.error ?? res.status}`); return; }
        const lines = (data?.recommendations ?? []).slice(0, 5).map((r, i) => `${i + 1}. **${r.name}** — ${r.reason}`);
        await interaction.editReply(lines.join("\n") || "No matches right now.");
        break;
      }

      case "nightrecommend": {
        await interaction.deferReply();
        const nightId = interaction.options.getInteger("nightid", true);
        const overrideIds = interaction.options.getString("memberids", false)?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
        const res = await fetch(`${apiBase}/game-nights/${nightId}/recommendations`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-island-bot-secret": botApiSharedSecret },
          body: JSON.stringify({ memberIds: overrideIds.length ? overrideIds : undefined, sessionLength: "any" })
        });
        const data = await res.json().catch(() => null) as { recommendations?: Array<{ name: string; reason: string; score: number }>; memberIds?: string[]; error?: string } | null;
        if (!res.ok) { await interaction.editReply(`Error: ${data?.error ?? res.status}`); return; }
        const lines = (data?.recommendations ?? []).slice(0, 5).map((r, i) => `${i + 1}. **${r.name}** — ${r.reason}`);
        await interaction.editReply(lines.join("\n") || "No matches.");
        break;
      }

      // ── /daily ────────────────────────────────────────────────────────────

      case "daily": {
        await interaction.deferReply();
        const { ok, status, data } = await api("POST", "/nuggies/daily", userId);
        const d = data as { newBalance?: number; amount?: number; error?: string } | null;
        if (!ok) {
          if (status === 409) {
            await interaction.editReply("⏰ Already claimed today. Resets at CST midnight.");
          } else if (status === 403) {
            await interaction.editReply("You're opted out of Nuggies. Use `/nuggies-opt-in` to rejoin.");
          } else {
            await interaction.editReply(`Error: ${d?.error ?? "unknown"}`);
          }
          return;
        }
        await interaction.editReply(`🍗 **${username}** claimed ${nuggie(d?.amount ?? 0)}! New balance: ${nuggie(d?.newBalance ?? 0)}`);
        break;
      }

      // ── /balance ──────────────────────────────────────────────────────────

      case "balance": {
        const targetUser = interaction.options.getUser("user");
        const targetId = targetUser?.id ?? userId;
        const targetName = targetUser?.username ?? username;
        const isOthers = targetUser && targetUser.id !== userId;

        await interaction.deferReply({ flags: isOthers ? undefined : MessageFlags.Ephemeral });

        const { ok, data } = await api("GET", `/nuggies/user/${targetId}`, userId);
        const d = data as { balance?: number; equippedItems?: Array<{ name: string; itemType: string; itemData: { emoji?: string; label?: string } }> } | null;

        if (!ok || d?.balance === undefined) {
          await interaction.editReply("Couldn't fetch balance.");
          return;
        }

        const title = d.equippedItems?.find((i) => i.itemType === "title");
        const flair = d.equippedItems?.find((i) => i.itemType === "flair");
        const badge = d.equippedItems?.find((i) => i.itemType === "badge");

        const titleStr = title ? ` · **${title.itemData.emoji ?? ""} ${title.itemData.label ?? title.name}**` : "";
        const flairStr = flair ? ` ${flair.itemData.emoji ?? ""}` : "";
        const badgeStr = badge ? ` ${badge.itemData.emoji ?? ""}` : "";

        await interaction.editReply(
          `${badgeStr}**${targetName}**${titleStr}${flairStr}\nBalance: ${nuggie(d.balance)}`
        );
        break;
      }

      // ── /give ─────────────────────────────────────────────────────────────

      case "give": {
        await interaction.deferReply();
        const target = interaction.options.getUser("user", true);
        const amount = interaction.options.getInteger("amount", true);

        if (target.id === userId) {
          await interaction.editReply("Can't send Nuggies to yourself.");
          return;
        }

        const { ok, data } = await api("POST", "/nuggies/trade", userId, { toDiscordUserId: target.id, amount });
        const d = data as { sent?: number; received?: number; fee?: number; error?: string } | null;

        if (!ok) {
          await interaction.editReply(`❌ ${d?.error ?? "Trade failed"}`);
          return;
        }

        await interaction.editReply(
          `💸 **${username}** sent ${nuggie(d?.sent ?? amount)} to **${target.username}** — they received ${nuggie(d?.received ?? 0)} (${d?.fee ?? 0} 🍗 fee)`
        );
        break;
      }

      // ── /shop ─────────────────────────────────────────────────────────────

      case "shop": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { ok, data } = await api("GET", "/nuggies/shop", userId);
        const d = data as { items?: Array<{ id: number; name: string; description: string; price: number; itemType: string; itemData: { emoji?: string }; owned: boolean }> } | null;
        if (!ok || !d?.items) { await interaction.editReply("Shop unavailable."); return; }

        const groupBy = (key: string) => d.items!.filter((i) => i.itemType === key);
        const formatItems = (items: typeof d.items) =>
          (items ?? []).map((i) => `${i.itemData.emoji ?? ""} **${i.name}** — ${i.price.toLocaleString()} 🍗 ${i.owned ? "✓" : ""}`).join("\n");

        const embed = new EmbedBuilder()
          .setTitle("🛒 Nuggies Shop")
          .setColor(0xf59e0b)
          .addFields(
            { name: "🏷️ Titles", value: formatItems(groupBy("title")) || "None", inline: false },
            { name: "✨ Flairs", value: formatItems(groupBy("flair")) || "None", inline: false },
            { name: "🏅 Badges", value: formatItems(groupBy("badge")) || "None", inline: false }
          )
          .setFooter({ text: "Use /buy <item name> to purchase" });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      // ── /buy ──────────────────────────────────────────────────────────────

      case "buy": {
        await interaction.deferReply();
        const itemName = interaction.options.getString("item", true).trim().toLowerCase();

        const shopRes = await api("GET", "/nuggies/shop", userId);
        const shopData = shopRes.data as { items?: Array<{ id: number; name: string; price: number; itemData: { emoji?: string }; owned: boolean }> } | null;
        const item = shopData?.items?.find((i) => i.name.toLowerCase() === itemName);
        if (!item) { await interaction.editReply("Item not found. Check the `/shop` for exact names."); return; }
        if (item.owned) { await interaction.editReply("Already own that item."); return; }

        const { ok, data } = await api("POST", `/nuggies/shop/${item.id}/buy`, userId);
        const d = data as { newBalance?: number; item?: { name: string }; error?: string } | null;

        if (!ok) {
          await interaction.editReply(`❌ ${d?.error ?? "Purchase failed"}`);
          return;
        }
        await interaction.editReply(`🎉 **${username}** bought **${item.itemData.emoji ?? ""} ${item.name}** for ${item.price.toLocaleString()} 🍗! Balance: ${nuggie(d?.newBalance ?? 0)}`);
        break;
      }

      // ── /equip ────────────────────────────────────────────────────────────

      case "equip": {
        await interaction.deferReply();
        const itemName = interaction.options.getString("item", true).trim().toLowerCase();

        const invRes = await api("GET", "/nuggies/inventory", userId);
        const invData = invRes.data as { inventory?: Array<{ itemId: number; name: string; equipped: boolean; itemData: { emoji?: string; label?: string } }> } | null;
        const item = invData?.inventory?.find((i) => i.name.toLowerCase() === itemName);
        if (!item) { await interaction.editReply("Item not in your inventory. Check `/shop` to buy it."); return; }

        const { ok, data } = await api("POST", `/nuggies/inventory/${item.itemId}/equip`, userId);
        const d = data as { equipped?: boolean; error?: string } | null;

        if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }

        const action = d?.equipped ? "equipped" : "unequipped";
        await interaction.editReply(`✅ **${username}** ${action} **${item.itemData.emoji ?? ""} ${item.name}**`);
        break;
      }

      // ── /coinflip ─────────────────────────────────────────────────────────

      case "coinflip": {
        await interaction.deferReply();
        const bet = interaction.options.getInteger("bet", true);
        const call = interaction.options.getString("call", true) as "heads" | "tails";
        const result = Math.random() < 0.5 ? "heads" : "tails";
        const won = result === call;
        const payout = won ? Math.floor(bet * 1.9) : 0;
        const delta = payout - bet;

        const { ok, data } = await api("POST", "/nuggies/trade", userId, {
          // Use the admin grant endpoint internally via applyTransaction
          // Actually hit the game endpoint — but we don't have a /coinflip endpoint
          // Use a workaround: call /nuggies/admin/grant with bot secret won't work for player
          // Better: we need a /nuggies/game endpoint. For now, handle this via a dedicated game route.
          // Fallback: use the generic approach below
        });

        // Apply result via API — call a game endpoint
        // Since we don't have /coinflip on the API (keeping API simple), bot handles payout
        // by calling grant (bot has shared secret but not admin role — can't use admin/grant)
        // Solution: add /nuggies/game/result endpoint for bot use only

        // For now: use applyTransaction pattern via a bot-only game endpoint
        // We'll call a simplified path: POST /nuggies/game/coinflip
        const gameRes = await api("POST", "/nuggies/game/coinflip", userId, { bet, won });
        const gd = gameRes.data as { newBalance?: number; error?: string } | null;

        if (!gameRes.ok) {
          await interaction.editReply(`❌ ${gd?.error ?? "Game failed"}`);
          return;
        }

        const emoji = result === "heads" ? "🪙" : "🥏";
        const outcome = won ? `✅ **${call.toUpperCase()}** — you win ${nuggie(payout)}! (net +${delta})` : `❌ **${result.toUpperCase()}** — you lose ${nuggie(bet)}`;
        await interaction.editReply(`${emoji} **${username}** flipped **${result}** (called ${call})\n${outcome}\nBalance: ${nuggie(gd?.newBalance ?? 0)}`);
        break;
      }

      // ── /blackjack ────────────────────────────────────────────────────────

      case "blackjack": {
        const bet = interaction.options.getInteger("bet", true);

        if (activeBlackjackGames.has(userId)) {
          await interaction.reply({ content: "You already have an active blackjack game.", flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferReply();

        // Check bet limit
        const maxBetRes = await api("GET", "/nuggies/me", userId);
        const meData = maxBetRes.data as { balance?: number } | null;
        if ((meData?.balance ?? 0) < bet) {
          await interaction.editReply(`❌ Insufficient Nuggies. Balance: ${nuggie(meData?.balance ?? 0)}`);
          return;
        }

        // Check game cooldown via dedicated endpoint
        const cooldownRes = await api("POST", "/nuggies/game/cooldown-check", userId, {});
        if (!cooldownRes.ok) {
          const cd = cooldownRes.data as { error?: string; secondsLeft?: number } | null;
          await interaction.editReply(`⏱️ ${cd?.error ?? "Game cooldown active"}`);
          return;
        }

        const game = startBlackjack(bet);
        activeBlackjackGames.set(userId, game);

        const playerTotal = handTotal(game.playerHand);
        const isBlackjack = playerTotal === 21;

        if (isBlackjack) {
          // Auto-resolve blackjack
          const payout = Math.floor(bet * 2.5);
          activeBlackjackGames.delete(userId);
          const gameRes = await api("POST", "/nuggies/game/blackjack", userId, { bet, payout, result: "blackjack" });
          const gd = gameRes.data as { newBalance?: number } | null;
          await interaction.editReply(
            `🃏✨ **BLACKJACK!** **${username}** hits 21!\n` +
            `Your hand: ${formatHand(game.playerHand)}\n` +
            `Payout: ${nuggie(payout)} | Balance: ${nuggie(gd?.newBalance ?? 0)}`
          );
          return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel("Hit").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel("Stand").setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.editReply({
          content:
            `🃏 **${username}**'s Blackjack — Bet: ${nuggie(bet)}\n` +
            `Your hand: ${formatHand(game.playerHand)} (${playerTotal})\n` +
            `Dealer: ${formatHand(game.dealerHand, true)}\n\n` +
            `Hit or Stand?`,
          components: [row],
        });

        const collector = msg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === userId && (i.customId === `bj_hit_${userId}` || i.customId === `bj_stand_${userId}`),
          time: 30_000,
        });

        collector.on("collect", async (btnInteraction) => {
          let current = activeBlackjackGames.get(userId);
          if (!current) return;

          if (btnInteraction.customId === `bj_hit_${userId}`) {
            current = hitPlayer(current);
            activeBlackjackGames.set(userId, current);
            const total = handTotal(current.playerHand);

            if (total > 21) {
              // Bust
              collector.stop("bust");
              activeBlackjackGames.delete(userId);
              const gameRes = await api("POST", "/nuggies/game/blackjack", userId, { bet, payout: 0, result: "lose" });
              const gd = gameRes.data as { newBalance?: number } | null;
              await btnInteraction.update({
                content:
                  `🃏 **${username}**'s Blackjack — BUST!\n` +
                  `Your hand: ${formatHand(current.playerHand)} (${total}) — BUST!\n` +
                  `Dealer: ${formatHand(current.dealerHand, true)}\n` +
                  `💀 Lost ${nuggie(bet)} | Balance: ${nuggie(gd?.newBalance ?? 0)}`,
                components: [],
              });
              return;
            }

            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel("Hit").setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel("Stand").setStyle(ButtonStyle.Danger)
            );
            await btnInteraction.update({
              content:
                `🃏 **${username}**'s Blackjack — Bet: ${nuggie(bet)}\n` +
                `Your hand: ${formatHand(current.playerHand)} (${total})\n` +
                `Dealer: ${formatHand(current.dealerHand, true)}\n\n` +
                `Hit or Stand?`,
              components: [disabledRow],
            });
          } else {
            // Stand
            collector.stop("stand");
          }
        });

        collector.on("end", async (_, reason) => {
          const current = activeBlackjackGames.get(userId);
          if (!current) return;
          activeBlackjackGames.delete(userId);

          if (reason === "bust") return; // already handled

          const finished = dealerPlay(current);
          const result = resolveGame(finished);
          const payout = calculatePayout(bet, result);

          const gameRes = await api("POST", "/nuggies/game/blackjack", userId, { bet, payout, result });
          const gd = gameRes.data as { newBalance?: number } | null;

          const playerT = handTotal(finished.playerHand);
          const dealerT = handTotal(finished.dealerHand);
          const content =
            `🃏 **${username}**'s Blackjack — ${resultEmoji(result)}\n` +
            `Your hand: ${formatHand(finished.playerHand)} (**${playerT}**)\n` +
            `Dealer: ${formatHand(finished.dealerHand)} (**${dealerT}**)\n` +
            `Payout: ${nuggie(payout)} | Balance: ${nuggie(gd?.newBalance ?? 0)}`;

          try {
            const m = await interaction.fetchReply();
            await m.edit({ content, components: [] });
          } catch {
            await interaction.editReply({ content, components: [] }).catch(() => {});
          }
        });

        break;
      }

      // ── /guessnumber ──────────────────────────────────────────────────────

      case "guessnumber": {
        const bet = interaction.options.getInteger("bet", true);
        await interaction.deferReply();

        // Check balance
        const meRes = await api("GET", "/nuggies/me", userId);
        const meData = meRes.data as { balance?: number } | null;
        if ((meData?.balance ?? 0) < bet) {
          await interaction.editReply(`❌ Not enough Nuggies. Balance: ${nuggie(meData?.balance ?? 0)}`);
          return;
        }

        // Cooldown check
        const cdRes = await api("POST", "/nuggies/game/cooldown-check", userId, {});
        if (!cdRes.ok) {
          const cd = cdRes.data as { error?: string } | null;
          await interaction.editReply(`⏱️ ${cd?.error ?? "Cooldown active"}`);
          return;
        }

        const secretNumber = Math.floor(Math.random() * 10) + 1;

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`guess_${userId}`)
          .setPlaceholder("Pick a number 1–10")
          .addOptions(
            Array.from({ length: 10 }, (_, i) =>
              new StringSelectMenuOptionBuilder().setLabel(String(i + 1)).setValue(String(i + 1))
            )
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const msg = await interaction.editReply({
          content: `🎯 **${username}** is guessing a number (1–10) — Bet: ${nuggie(bet)}\n*Correct = 8× payout!*`,
          components: [row],
        });

        const collector = msg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          filter: (i) => i.user.id === userId && i.customId === `guess_${userId}`,
          time: 30_000,
          max: 1,
        });

        collector.on("collect", async (selectInteraction) => {
          const guess = parseInt(selectInteraction.values[0], 10);
          const won = guess === secretNumber;
          const payout = won ? bet * 8 : 0;

          const gameRes = await api("POST", "/nuggies/game/guessnumber", userId, { bet, payout, won });
          const gd = gameRes.data as { newBalance?: number } | null;

          const outcomeText = won
            ? `✅ **CORRECT!** It was ${secretNumber}! Payout: ${nuggie(payout)}`
            : `❌ **WRONG!** It was **${secretNumber}**. Lost ${nuggie(bet)}`;

          await selectInteraction.update({
            content:
              `🎯 **${username}** guessed **${guess}**\n` +
              `${outcomeText}\nBalance: ${nuggie(gd?.newBalance ?? 0)}`,
            components: [],
          });
        });

        collector.on("end", async (collected) => {
          if (collected.size === 0) {
            await interaction.editReply({ content: "⏰ Timed out — no guess made, bet returned.", components: [] }).catch(() => {});
          }
        });

        break;
      }

      // ── /loan ─────────────────────────────────────────────────────────────

      case "loan": {
        const sub = interaction.options.getSubcommand();

        if (sub === "offer") {
          await interaction.deferReply();
          const borrower = interaction.options.getUser("borrower", true);
          const amount = interaction.options.getInteger("amount", true);
          const days = interaction.options.getInteger("days", false) ?? undefined;
          const interest = interaction.options.getInteger("interest", false) ?? undefined;
          const collateral = interaction.options.getInteger("collateral", false) ?? 0;

          const { ok, data } = await api("POST", "/nuggies/loan/offer", userId, {
            toDiscordUserId: borrower.id, amount, durationDays: days, interestPct: interest, collateral,
          });
          const d = data as { loanId?: number; amountDue?: number; dueAt?: string; collateral?: number; error?: string } | null;

          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }

          await interaction.editReply(
            `🤝 **${username}** offered a loan to **${borrower.username}**\n` +
            `Principal: ${nuggie(amount)} | Due back: ${nuggie(d?.amountDue ?? 0)}` +
            (d?.collateral ? ` | Collateral required: ${nuggie(d.collateral)}` : "") +
            `\nLoan ID: \`${d?.loanId}\` · Due: <t:${Math.floor(new Date(d?.dueAt ?? Date.now()).getTime() / 1000)}:R>\n` +
            `**${borrower.username}**: use \`/loan accept ${d?.loanId}\` to accept.`
          );
          break;
        }

        if (sub === "accept") {
          await interaction.deferReply();
          const loanId = interaction.options.getInteger("id", true);
          const { ok, data } = await api("POST", `/nuggies/loan/${loanId}/accept`, userId);
          const d = data as { principal?: number; dueAt?: string; error?: string } | null;
          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }
          await interaction.editReply(`✅ **${username}** accepted loan \`${loanId}\`. Received ${nuggie(d?.principal ?? 0)} · Due <t:${Math.floor(new Date(d?.dueAt ?? Date.now()).getTime() / 1000)}:R>`);
          break;
        }

        if (sub === "repay") {
          await interaction.deferReply();
          const loanId = interaction.options.getInteger("id", true);
          const { ok, data } = await api("POST", `/nuggies/loan/${loanId}/repay`, userId);
          const d = data as { amountPaid?: number; collateralReturned?: number; error?: string } | null;
          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }
          await interaction.editReply(
            `✅ **${username}** repaid loan \`${loanId}\` — ${nuggie(d?.amountPaid ?? 0)} paid` +
            (d?.collateralReturned ? ` + ${nuggie(d.collateralReturned)} collateral returned` : "")
          );
          break;
        }

        if (sub === "cancel") {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const loanId = interaction.options.getInteger("id", true);
          const { ok, data } = await api("POST", `/nuggies/loan/${loanId}/cancel`, userId);
          const d = data as { error?: string } | null;
          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }
          await interaction.editReply(`✅ Loan \`${loanId}\` cancelled.`);
          break;
        }

        if (sub === "list") {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const { ok, data } = await api("GET", "/nuggies/loans", userId);
          const d = data as { loans?: Array<{ id: number; status: string; principal: number; amountDue: number; dueAt: string; isLender: boolean; collateral: number }> } | null;
          if (!ok || !d?.loans?.length) { await interaction.editReply("No active loans."); return; }

          const lines = d.loans.map((l) =>
            `\`${l.id}\` ${l.isLender ? "📤 Lent" : "📥 Borrowed"} ${nuggie(l.principal)} · Due ${nuggie(l.amountDue)} · <t:${Math.floor(new Date(l.dueAt).getTime() / 1000)}:R> · ${l.status}`
          );
          await interaction.editReply(lines.join("\n"));
          break;
        }
        break;
      }

      // ── /market ───────────────────────────────────────────────────────────

      case "market": {
        const sub = interaction.options.getSubcommand();

        if (sub === "browse") {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const { ok, data } = await api("GET", "/nuggies/market", userId);
          const d = data as { listings?: Array<{ id: number; price: number; item: { name: string; itemData: { emoji?: string } }; seller: { username: string } }> } | null;
          if (!ok || !d?.listings?.length) { await interaction.editReply("Marketplace is empty right now."); return; }
          const lines = d.listings.slice(0, 15).map((l) =>
            `\`${l.id}\` ${l.item.itemData.emoji ?? ""} **${l.item.name}** — ${l.price.toLocaleString()} 🍗 · by ${l.seller.username}`
          );
          await interaction.editReply(lines.join("\n") + "\n\nUse `/market buy <id>` to purchase.");
          break;
        }

        if (sub === "list") {
          await interaction.deferReply();
          const itemName = interaction.options.getString("item", true).trim().toLowerCase();
          const price = interaction.options.getInteger("price", true);

          const invRes = await api("GET", "/nuggies/inventory", userId);
          const invData = invRes.data as { inventory?: Array<{ itemId: number; name: string }> } | null;
          const item = invData?.inventory?.find((i) => i.name.toLowerCase() === itemName);
          if (!item) { await interaction.editReply("Item not in your inventory."); return; }

          const { ok, data } = await api("POST", "/nuggies/market/list", userId, { itemId: item.itemId, price });
          const d = data as { listingId?: number; error?: string } | null;
          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }
          await interaction.editReply(`📦 **${username}** listed **${item.name}** for ${price.toLocaleString()} 🍗 (listing ID: \`${d?.listingId}\`)`);
          break;
        }

        if (sub === "buy") {
          await interaction.deferReply();
          const listingId = interaction.options.getInteger("id", true);
          const { ok, data } = await api("POST", `/nuggies/market/${listingId}/buy`, userId);
          const d = data as { price?: number; sellerReceives?: number; fee?: number; error?: string } | null;
          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }
          await interaction.editReply(`🛒 **${username}** bought listing \`${listingId}\` for ${nuggie(d?.price ?? 0)}!`);
          break;
        }

        if (sub === "cancel") {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const listingId = interaction.options.getInteger("id", true);
          const { ok, data } = await api("DELETE", `/nuggies/market/${listingId}`, userId);
          const d = data as { error?: string } | null;
          if (!ok) { await interaction.editReply(`❌ ${d?.error ?? "Failed"}`); return; }
          await interaction.editReply(`✅ Listing \`${listingId}\` cancelled.`);
          break;
        }
        break;
      }

      // ── /nuggies-opt-out / opt-in ─────────────────────────────────────────

      case "nuggies-opt-out": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { ok } = await api("POST", "/nuggies/opt-out", userId);
        await interaction.editReply(ok ? "✅ Opted out of Nuggies. Your balance is preserved." : "❌ Failed.");
        break;
      }

      case "nuggies-opt-in": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { ok } = await api("POST", "/nuggies/opt-in", userId);
        await interaction.editReply(ok ? "✅ Welcome back to Nuggies 🍗!" : "❌ Failed.");
        break;
      }
    }
  } catch (error) {
    console.error(`${interaction.commandName} failed:`, error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "Something went wrong. Please try again." }).catch(() => {});
    }
  }
});

if (token) {
  client.login(token);
} else {
  console.log("DISCORD_BOT_TOKEN missing — bot not started.");
}
