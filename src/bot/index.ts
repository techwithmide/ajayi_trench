import { Bot, type Context } from "grammy";
import {
  createPosition,
  getPositionByIdForChat,
  getOpenPositionByMintForChat,
  getOpenPositionsForChat,
  getClosedPositionsForChat,
  getLeaderboardGlobal,
  getCachedTelegramUser,
  upsertTelegramUser,
  closePosition,
} from "../db/index.js";
import { fetchTokenInfo, fetchCurrentPrice } from "../price/index.js";
import { simulateBuy, simulateSell } from "../simulation/lite-jupiter.js";
import {
  startWatcher,
  stopWatcher,
  restoreWatchers,
  getActiveWatcherCountForChat,
} from "../watcher/manager.js";
import type { NotifyFn } from "../watcher/manager.js";
import {
  formatUsd,
  formatPnL,
  formatPercent,
  formatDuration,
  formatTimestamp,
  isSolanaAddress,
  truncateAddress,
  generateId,
  escapeHtml,
} from "../utils/format.js";
import type { LeaderboardEntry } from "../types.js";

const VIRTUAL_USD = 100;

function upsertFromTelegramUser(
  user: NonNullable<Context["from"]>,
): void {
  upsertTelegramUser({
    id: user.id,
    first_name: user.first_name,
    ...(user.username != null ? { username: user.username } : {}),
    ...(user.last_name != null ? { last_name: user.last_name } : {}),
  });
}

/** Resolve @username / name via DB cache, then Telegram getChat; falls back to id. */
async function resolveLeaderboardLabel(
  api: Context["api"],
  e: LeaderboardEntry,
): Promise<string> {
  const legacySuffix = e.openedByUserId == null ? ` <i>(legacy)</i>` : "";

  if (e.username) {
    return `@${escapeHtml(e.username)}${legacySuffix}`;
  }

  const chatIdStr = String(e.bucketKey);

  if (e.bucketKey > 0) {
    const cached = getCachedTelegramUser(e.bucketKey);
    if (cached?.username) {
      return `@${escapeHtml(cached.username)}${legacySuffix}`;
    }
    if (cached?.firstName) {
      const name = [cached.firstName, cached.lastName].filter(Boolean).join(" ");
      return `${escapeHtml(name)}${legacySuffix}`;
    }
  }

  try {
    const chat = await api.getChat(chatIdStr);
    if (chat.type === "private") {
      if (e.bucketKey > 0) {
        upsertTelegramUser({
          id: e.bucketKey,
          first_name: chat.first_name,
          ...(chat.username != null ? { username: chat.username } : {}),
          ...(chat.last_name != null ? { last_name: chat.last_name } : {}),
        });
      }
      if (chat.username)
        return `@${escapeHtml(chat.username)}${legacySuffix}`;
      const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ");
      if (name) return `${escapeHtml(name)}${legacySuffix}`;
    }
    if (
      chat.type === "group" ||
      chat.type === "supergroup" ||
      chat.type === "channel"
    ) {
      if ("username" in chat && chat.username)
        return `@${escapeHtml(chat.username)}${legacySuffix}`;
      if ("title" in chat && chat.title)
        return `${escapeHtml(chat.title)}${legacySuffix}`;
    }
  } catch {
    // Bot can’t see chat (blocked, deleted, etc.)
  }

  if (e.bucketKey < 0) {
    return `Group <code>${e.bucketKey}</code>${legacySuffix}`;
  }
  return `User <code>${e.bucketKey}</code>${legacySuffix}`;
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // Cache Telegram profile fields (leaderboard + getChat failures when user blocked bot)
  bot.use(async (ctx, next) => {
    if (ctx.from) upsertFromTelegramUser(ctx.from);
    return next();
  });

  // ─── Access control (closed experiment) ────────────────────────────────────
  // Set one or both:
  // - BOT_WHITELIST_CHAT_IDS="1271800239,12345"
  // - BOT_WHITELIST_USERNAMES="techwithmide,otheruser" (without @)
  const whitelistChatIds = new Set(
    (process.env.BOT_WHITELIST_CHAT_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const whitelistUsernames = new Set(
    (process.env.BOT_WHITELIST_USERNAMES ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  );

  bot.use(async (ctx, next) => {
    // If no whitelist configured, allow everything (to avoid accidental lockout)
    if (whitelistChatIds.size === 0 && whitelistUsernames.size === 0) {
      return next();
    }

    const chatId = ctx.chat?.id?.toString();
    const username = ctx.from?.username?.toLowerCase();
    const allowed =
      (chatId && whitelistChatIds.has(chatId)) ||
      (username && whitelistUsernames.has(username));

    if (!allowed) {
      // Keep response minimal to avoid leaking details
      if (chatId) console.warn(`[Auth] blocked chat=${chatId} user=@${username ?? "?"}`);
      // Only attempt to reply when possible; ignore failures
      try {
        await ctx.reply("⛔️ This bot is in a closed test.");
      } catch {}
      return;
    }

    return next();
  });

  // Quick debug: confirm we're receiving updates + basic context
  bot.use(async (ctx, next) => {
    try {
      const text = (ctx.message as any)?.text;
      if (typeof text === "string") {
        console.log(
          `[Update] chat=${ctx.chat?.id ?? "?"} type=${ctx.chat?.type ?? "?"} text=${text}`,
        );
      }
    } catch {
      // ignore logging errors
    }
    return next();
  });

  // ─── Notify helper (passed into watcher callbacks) ─────────────────────────
  const notify: NotifyFn = async (chatId, message) => {
    await bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
  };

  // Restore open positions after restart
  restoreWatchers(notify).catch(console.error);

  // ─── /start ────────────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `<b>AJAYI Trench Bot</b>\n\n` +
        `Paste any Solana token contract address and I'll open a simulated <b>$${VIRTUAL_USD}</b> position.\n\n` +
        `Buys and sells are simulated via <b>Jupiter</b> (real slippage, real pool depth).\n\n` +
        `<b>Strategy:</b>\n` +
        `Take profit at <b>+100%</b>\n` +
        `Stop loss at <b>−50%</b>\n\n` +
        `<b>Commands:</b>\n` +
        `/positions — Open positions + unrealised P&L\n` +
        `/history   — Closed trade history\n` +
        `/pnl       — Weekly performance summary\n` +
        `/leaderboard — Global: traders by realised P&amp;L (wins / losses)\n` +
        `/close &lt;id&gt; — Manually close a position`,
      { parse_mode: "HTML" },
    );
  });

  // ─── CA paste → open position ──────────────────────────────────────────────
  bot.on("message:text", async (ctx, next) => {
    const raw = ctx.message.text.trim();

    // Ignore bot commands
    if (raw.startsWith("/")) return await next();

    // Bail out if it's not a Solana address
    if (!isSolanaAddress(raw)) return await next();

    const mint = raw;
    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();

    // Prevent duplicate open positions for the same token (this chat only)
    const existing = getOpenPositionByMintForChat(mint, chatIdStr);
    if (existing) {
      await ctx.reply(
        `⚠️ Already tracking <b>${existing.symbol}</b>\n` +
          `<code>${truncateAddress(mint)}</code> | ID: <code>${existing.id}</code>`,
        { parse_mode: "HTML" },
      );
      return;
    }

    const status = await ctx.reply("🔍 Fetching token info…");
    const edit = (text: string) =>
      ctx.api.editMessageText(chatId, status.message_id, text, {
        parse_mode: "HTML",
      });

    try {
      // ── Step 1: Token info from DexScreener / GeckoTerminal ──
      const tokenInfo = await fetchTokenInfo(mint);
      if (!tokenInfo) {
        await edit(
          `❌ Token not found on DexScreener or GeckoTerminal.\n\n` +
            `Make sure this is a valid Solana SPL token mint address.`,
        );
        return;
      }

      // ── Step 2: Simulate the buy via Jupiter ──
      await edit(`⚙️ Simulating $${VIRTUAL_USD} buy via Jupiter…`);
      const trade = await simulateBuy(mint, VIRTUAL_USD);

      if (!trade) {
        await edit(
          `⚠️ <b>${tokenInfo.symbol}</b> — Jupiter has no route for this token yet.\n\n` +
            `Position will still be tracked by price change only (no slippage simulation at exit).`,
        );
      }

      // ── Step 3: Persist the position ──
      const position = createPosition({
        id: generateId(),
        chatId: chatIdStr,
        mint,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        entryPrice: tokenInfo.priceUsd,
        entryTime: Date.now(),
        virtualUsd: VIRTUAL_USD,
        tokenAmountRaw: trade?.outputAmountRaw ?? "0",
        currentPrice: tokenInfo.priceUsd,
        lastUpdated: Date.now(),
        openedByUserId: ctx.from?.id ?? null,
        openedByUsername: ctx.from?.username ?? null,
      });

      // ── Step 4: Start price watcher ──
      startWatcher(position, notify);

      const jupiterBlock = trade
        ? `🔀 Route: ${trade.route}\n📉 Entry impact: ${trade.priceImpactPct.toFixed(2)}%`
        : `⚠️ No Jupiter route — tracking by price change`;

      await edit(
        `<b>Position Opened — $${tokenInfo.symbol}</b>\n\n` +
          `Entry price:  ${formatUsd(tokenInfo.priceUsd)}\n` +
          `Virtual size: ${formatUsd(VIRTUAL_USD)}\n` +
          `Mint: <code>${mint}</code>\n` +
          `ID:   <code>${position.id}</code>\n\n` +
          `${jupiterBlock}\n\n` +
          `TP: <b>+100%</b>  🛑 SL: <b>−50%</b>  📡 Poll: <b>30s</b>`,
      );
    } catch (err: any) {
      console.error("[Bot] Error opening position:", err);
      await edit(`❌ Unexpected error: ${err.message}`);
    }
  });

  // ─── /positions ────────────────────────────────────────────────────────────
  bot.command("positions", async (ctx) => {
    const positions = getOpenPositionsForChat(ctx.chat.id.toString());

    if (positions.length === 0) {
      await ctx.reply(
        "No open positions. Paste a Solana token address to start tracking.",
      );
      return;
    }

    const lines = positions.map((p, i) => {
      const current = p.currentPrice ?? p.entryPrice;
      const changePct = ((current - p.entryPrice) / p.entryPrice) * 100;
      const unrealised = (changePct / 100) * p.virtualUsd;
      const arrow = changePct >= 0 ? "🟢" : "🔴";
      const held = formatDuration(p.entryTime, Date.now());

      return [
        `${i + 1}. ${arrow} <b>$${p.symbol}</b> — <code>${p.id}</code>`,
        `   Entry ${formatUsd(p.entryPrice)} → Now ${formatUsd(current)}`,
        `   Unrealised: <b>${formatPnL(unrealised)}</b> (${formatPercent(changePct)}) | Held: ${held}`,
      ].join("\n");
    });

    await ctx.reply(
      `<b>Open Positions (${positions.length})</b>\n\n${lines.join("\n\n")}`,
      { parse_mode: "HTML" },
    );
  });

  // ─── /history ──────────────────────────────────────────────────────────────
  bot.command("history", async (ctx) => {
    const positions = getClosedPositionsForChat(ctx.chat.id.toString());

    if (positions.length === 0) {
      await ctx.reply("No closed positions yet.");
      return;
    }

    const recent = positions.slice(0, 15);
    const lines = recent.map((p, i) => {
      const isWin = (p.pnlUsd ?? 0) >= 0;
      const emoji = isWin ? "🟢" : "🔴";
      const tag =
        p.exitReason === "TAKE_PROFIT"
          ? "TP"
          : p.exitReason === "STOP_LOSS"
            ? "SL"
            : "Manual";

      return [
        `${i + 1}. ${emoji} <b>$${p.symbol}</b> [${tag}]`,
        `   ${formatUsd(p.entryPrice)} → ${formatUsd(p.exitPrice!)}`,
        `   P&L: <b>${formatPnL(p.pnlUsd!)}</b> (${formatPercent(p.pnlPercent!)})`,
      ].join("\n");
    });

    await ctx.reply(
      `<b>Trade History</b> (last ${recent.length} of ${positions.length})\n\n${lines.join("\n\n")}`,
      { parse_mode: "HTML" },
    );
  });

  // ─── /pnl ──────────────────────────────────────────────────────────────────
  bot.command("pnl", async (ctx) => {
    const chatIdStr = ctx.chat.id.toString();
    const closed = getClosedPositionsForChat(chatIdStr);
    const open = getOpenPositionsForChat(chatIdStr);

    if (closed.length === 0 && open.length === 0) {
      await ctx.reply("No trades yet. Paste a token address to start.");
      return;
    }

    const totalTrades = closed.length;
    const wins = closed.filter((p) => (p.pnlUsd ?? 0) > 0).length;
    const losses = closed.filter((p) => (p.pnlUsd ?? 0) <= 0).length;
    const realised = closed.reduce((s, p) => s + (p.pnlUsd ?? 0), 0);
    const winRate =
      totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0";

    const avgWin =
      wins > 0
        ? closed
            .filter((p) => (p.pnlUsd ?? 0) > 0)
            .reduce((s, p) => s + (p.pnlUsd ?? 0), 0) / wins
        : 0;
    const avgLoss =
      losses > 0
        ? closed
            .filter((p) => (p.pnlUsd ?? 0) <= 0)
            .reduce((s, p) => s + (p.pnlUsd ?? 0), 0) / losses
        : 0;

    // Unrealised from open positions
    const unrealised = open.reduce((s, p) => {
      const current = p.currentPrice ?? p.entryPrice;
      return s + ((current - p.entryPrice) / p.entryPrice) * p.virtualUsd;
    }, 0);

    await ctx.reply(
      `<b>Performance Summary</b>\n\n` +
        `<b>Trades</b>\n` +
        `Closed: <b>${totalTrades}</b>  |  Open: <b>${open.length}</b>\n` +
        `🟢 Wins: <b>${wins}</b>  🔴 Losses: <b>${losses}</b>\n` +
        `Win rate: <b>${winRate}%</b>\n` +
        `Avg win: <b>${formatUsd(avgWin)}</b>  Avg loss: <b>${formatUsd(Math.abs(avgLoss))}</b>\n\n` +
        `<b>P&L</b>\n` +
        `Total deployed: <b>${formatUsd(totalTrades * VIRTUAL_USD)}</b>\n` +
        `Realised P&L:   <b>${formatPnL(realised)}</b>\n` +
        `Unrealised P&L: <b>${formatPnL(unrealised)}</b>\n` +
        `Net P&L:        <b>${formatPnL(realised + unrealised)}</b>\n\n` +
        `Active watchers (your chat): <b>${getActiveWatcherCountForChat(chatIdStr)}</b>`,
      { parse_mode: "HTML" },
    );
  });

  // ─── /leaderboard ─────────────────────────────────────────────────────────
  bot.command("leaderboard", async (ctx) => {
    const rows = getLeaderboardGlobal();

    if (rows.length === 0) {
      await ctx.reply(
        "<b>Global leaderboard</b>\n\nNo closed trades yet. " +
          "When any user’s positions hit TP/SL or are /closed, stats appear here.",
        { parse_mode: "HTML" },
      );
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const top = rows.slice(0, 20);

    const lines = await Promise.all(
      top.map(async (e, i) => {
        const medal = i < 3 ? `${medals[i]} ` : `${i + 1}. `;
        const who = await resolveLeaderboardLabel(ctx.api, e);
        const wr =
          e.trades > 0 ? ((e.wins / e.trades) * 100).toFixed(1) : "0.0";

        return [
          `${medal}<b>${who}</b>`,
          `   P&amp;L: <b>${formatPnL(e.realisedPnl)}</b>  |  🟢 ${e.wins}W  🔴 ${e.losses}L  (${wr}% WR)  ·  ${e.trades} closed`,
        ].join("\n");
      }),
    );

    const more =
      rows.length > top.length
        ? `\n\n<i>Showing top ${top.length} of ${rows.length} traders.</i>`
        : "";

    await ctx.reply(
      `<b>Global leaderboard</b> — all chats (realised P&amp;L, closed trades only)\n\n` +
        lines.join("\n\n") +
        more,
      { parse_mode: "HTML" },
    );
  });

  // ─── /close <id> ───────────────────────────────────────────────────────────
  bot.command("close", async (ctx) => {
    const posId = ctx.message?.text?.split(" ")[1]?.trim();

    if (!posId) {
      await ctx.reply("Usage: /close <code>&lt;position_id&gt;</code>", {
        parse_mode: "HTML",
      });
      return;
    }

    const position = getPositionByIdForChat(posId, ctx.chat.id.toString());

    if (!position || position.status !== "OPEN") {
      await ctx.reply(
        `❌ Position <code>${posId}</code> not found, already closed, or not yours in this chat.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    const closing = await ctx.reply(
      `⏳ Fetching exit price for <b>$${position.symbol}</b>…`,
      { parse_mode: "HTML" },
    );

    const currentPrice =
      (await fetchCurrentPrice(position.mint)) ??
      position.currentPrice ??
      position.entryPrice;

    const trade = await simulateSell(position.mint, position.tokenAmountRaw);
    const exitUsd =
      trade?.outputUsd ?? (currentPrice / position.entryPrice) * VIRTUAL_USD;

    stopWatcher(posId);
    const closed = closePosition(posId, currentPrice, exitUsd, "MANUAL");

    if (!closed) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        closing.message_id,
        "❌ Failed to close position.",
      );
      return;
    }

    const jupBlock = trade
      ? `Route: ${trade.route}\n📉 Exit slippage: ${trade.priceImpactPct.toFixed(2)}%`
      : `Jupiter unavailable — P&L estimated from price`;

    await ctx.api.editMessageText(
      ctx.chat.id,
      closing.message_id,
      `<b>Manually Closed — $${position.symbol}</b>\n\n` +
        `Entry:    ${formatUsd(position.entryPrice)}\n` +
        `Exit:     ${formatUsd(currentPrice)}\n` +
        `Returned: ${formatUsd(exitUsd)}\n` +
        `P&L:      ${formatPnL(closed.pnlUsd!)} (${formatPercent(closed.pnlPercent!)})\n\n` +
        `${jupBlock}\n` +
        `⏱ Held: ${formatDuration(position.entryTime, Date.now())}`,
      { parse_mode: "HTML" },
    );
  });

  return bot;
}
