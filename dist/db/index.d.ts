import Database from "better-sqlite3";
import type { Position } from "../types";
export declare function getDb(): Database.Database;
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
//# sourceMappingURL=index.d.ts.map