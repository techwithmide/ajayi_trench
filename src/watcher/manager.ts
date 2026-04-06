import {
  getAllOpenPositions,
  getOpenPositionsForChat,
  updatePositionPrice,
  closePosition,
} from "../db/index.js";
import { fetchCurrentPrice, fetchTokenInfo } from "../price/index.js";
import { simulateSell } from "../simulation/lite-jupiter.js";
import type { Position } from "../types.js";
import {
  formatUsd,
  formatPnL,
  formatPercent,
  formatDuration,
  formatCompactUsd,
} from "../utils/format.js";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "30000", 10);

const activeWatchers = new Map<string, ReturnType<typeof setInterval>>();

export type NotifyFn = (chatId: string, message: string) => Promise<void>;

export function startWatcher(position: Position, notify: NotifyFn): void {
  if (activeWatchers.has(position.id)) {
    console.log(
      `[Watcher] Already watching ${position.symbol} (${position.id})`,
    );
    return;
  }

  console.log(
    `[Watcher] ▶ ${position.symbol} | ${position.strategyProfileId} | TP ${(position.takeProfitThreshold * 100).toFixed(0)}% SL ${(position.stopLossThreshold * 100).toFixed(0)}% | entry $${position.entryPrice} | poll ${POLL_INTERVAL_MS / 1000}s`,
  );
  const handle = setInterval(() => {
    tick(position, notify).catch((err) =>
      console.error(`[Watcher] Unhandled error for ${position.symbol}: `, err),
    );
  }, POLL_INTERVAL_MS);

  activeWatchers.set(position.id, handle);
}

export function stopWatcher(positionId: string): void {
  const handle = activeWatchers.get(positionId);
  if (handle) {
    clearInterval(handle);
    activeWatchers.delete(positionId);
  }
}

export function getActiveWatcherCount(): number {
  return activeWatchers.size;
}

/** Watchers running for positions owned by this chat (same DB as global restore). */
export function getActiveWatcherCountForChat(chatId: string): number {
  const open = getOpenPositionsForChat(chatId);
  return open.filter((p) => activeWatchers.has(p.id)).length;
}

export async function restoreWatchers(notify: NotifyFn): Promise<void> {
  const open = getAllOpenPositions();
  if (open.length === 0) return;

  console.log(`[Watcher] Restoring ${open.length} open position(s) from DB...`);
  for (const pos of open) {
    startWatcher(pos, notify);
  }
}

async function tick(position: Position, notify: NotifyFn): Promise<void> {
  const currentPrice = await fetchCurrentPrice(position.mint);

  if (!currentPrice) {
    console.warn(
      `[Watcher] No price for ${position.symbol} - will retry next tick`,
    );
    return;
  }

  updatePositionPrice(position.id, currentPrice);
  const change = (currentPrice - position.entryPrice) / position.entryPrice;

  const changePct = (change * 100).toFixed(2);
  const indicator = change >= 0 ? "+" : "-";

  console.log(
    `[Watcher] ${position.symbol} ${indicator} $${currentPrice} (${changePct}%) | entry $${position.entryPrice}`,
  );

  if (change >= position.takeProfitThreshold) {
    await exit(position, currentPrice, "TAKE_PROFIT", notify);
  } else if (change <= position.stopLossThreshold) {
    await exit(position, currentPrice, "STOP_LOSS", notify);
  }
}

async function exit(
  position: Position,
  currentPrice: number,
  reason: "TAKE_PROFIT" | "STOP_LOSS",
  notify: NotifyFn,
): Promise<void> {
  stopWatcher(position.id);
  console.log(`[Watcher] ${reason} hit for ${position.symbol}`);

  const trade = await simulateSell(position.mint, position.tokenAmountRaw);

  const exitUsd =
    trade?.outputUsd ??
    (currentPrice / position.entryPrice) * position.virtualUsd;
  const closed = closePosition(position.id, currentPrice, exitUsd, reason);

  if (!closed) return;

  const isWin = (closed.pnlUsd ?? 0) >= 0;
  const emoji = isWin ? "WIN" : "LOSS";
  const label = reason === "TAKE_PROFIT" ? "Take Profit Hit" : "Stop Loss Hit";

  const tokenInfo = await fetchTokenInfo(position.mint).catch(() => null);
  const capLine =
    tokenInfo?.marketCap != null
      ? `MCap: ${formatCompactUsd(tokenInfo.marketCap)}`
      : tokenInfo?.fdv != null
        ? `FDV: ${formatCompactUsd(tokenInfo.fdv)}`
        : null;

  const jupiterInfo = trade
    ? [
        `Slippage: <b>${trade.priceImpactPct.toFixed(2)}%</b>`,
        `Route: ${trade.route}`,
      ].join("\n")
    : "Jupiter route unavailable — P&L estimated from price";

  const msg = [
    `${emoji} <b>${label} — $${position.symbol}</b>`,
    ...(capLine ? [capLine] : []),
    ``,
    `Entry:       ${formatUsd(position.entryPrice)}`,
    `Exit:        ${formatUsd(currentPrice)}`,
    ``,
    `Deployed:    ${formatUsd(position.virtualUsd)}`,
    `Returned:    ${formatUsd(exitUsd)}`,
    `P&L:         ${formatPnL(closed.pnlUsd!)} (${formatPercent(closed.pnlPercent!)})`,
    ``,
    jupiterInfo,
    ``,
    `⏱ Held: ${formatDuration(position.entryTime, Date.now())}`,
  ].join("\n");

  await notify(position.chatId, msg);
}
