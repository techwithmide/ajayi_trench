/**
 * Single strategy profile for the closed experiment.
 *
 * - TP: +60%
 * - SL: −40%
 *
 * Access control (optional):
 * - BOT_WHITELIST_CHAT_IDS / BOT_WHITELIST_USERNAMES
 *
 * If the whitelist env is empty, access is open (everyone can use the bot).
 */

import type { StrategyProfileId } from "../types.js";

export type StrategyProfile = {
  id: StrategyProfileId;
  /** Price change fraction vs entry, e.g. 0.6 = +60% */
  takeProfitThreshold: number;
  /** Negative fraction, e.g. -0.4 = −40% */
  stopLossThreshold: number;
};

export const STRATEGY_TRENCH_60: StrategyProfile = {
  id: "trench_60",
  takeProfitThreshold: 0.6,
  stopLossThreshold: -0.4,
};

function parseChatIdSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function parseUsernameSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  );
}

function tierMatches(
  chatId: string | undefined,
  usernameLower: string | undefined,
  chatIds: Set<string>,
  usernames: Set<string>,
): boolean {
  return (
    (!!chatId && chatIds.has(chatId)) ||
    (!!usernameLower && usernames.has(usernameLower))
  );
}

/** True if whitelist env is non-empty (restricted access mode). */
export function isStrategyAccessRestricted(): boolean {
  const c = parseChatIdSet(process.env.BOT_WHITELIST_CHAT_IDS);
  const u = parseUsernameSet(process.env.BOT_WHITELIST_USERNAMES);
  return c.size + u.size > 0;
}

export function isUserAllowedForBot(
  chatId: string | undefined,
  username: string | undefined | null,
): boolean {
  if (!isStrategyAccessRestricted()) return true;

  const usernameLower = username?.toLowerCase();
  const c = parseChatIdSet(process.env.BOT_WHITELIST_CHAT_IDS);
  const u = parseUsernameSet(process.env.BOT_WHITELIST_USERNAMES);
  return tierMatches(chatId, usernameLower, c, u);
}

/** Resolve active strategy for an allowed user. */
export function resolveStrategyForUser(
  chatId: string | undefined,
  username: string | undefined | null,
): StrategyProfile {
  void chatId;
  void username;
  return STRATEGY_TRENCH_60;
}
