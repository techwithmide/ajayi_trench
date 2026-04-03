import Database from "better-sqlite3";
import type { LeaderboardEntry, Position } from "../types.js";
export declare function getDb(): Database.Database;
export type CachedTelegramUser = {
    userId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
};
/** Remember names from any update (getChat may fail if user blocked the bot). */
export declare function upsertTelegramUser(from: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
}): void;
export declare function getCachedTelegramUser(userId: number): CachedTelegramUser | null;
export declare function createPosition(pos: Omit<Position, "status">): Position;
export declare function updatePositionPrice(id: string, currentPrice: number): void;
export declare function closePosition(id: string, exitPrice: number, exitUsd: number, exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "MANUAL"): Position | null;
export declare function getPositionById(id: string): Position | null;
export declare function getPositionByIdForChat(id: string, chatId: string): Position | null;
export declare function getOpenPositionByMint(mint: string): Position | null;
/** Same mint can be open in different chats — scope duplicate check to this chat. */
export declare function getOpenPositionByMintForChat(mint: string, chatId: string): Position | null;
export declare function getAllOpenPositions(): Position[];
export declare function getOpenPositionsForChat(chatId: string): Position[];
export declare function getAllClosedPositions(): Position[];
export declare function getClosedPositionsForChat(chatId: string): Position[];
/**
 * Rank traders bot-wide by realised P&L (closed positions only, all chats).
 * Rows with `opened_by_user_id` merge by user; legacy rows split by `chat_id`
 * (private chats → one row per user; group legacy → one row per group).
 */
export declare function getLeaderboardGlobal(): LeaderboardEntry[];
//# sourceMappingURL=index.d.ts.map