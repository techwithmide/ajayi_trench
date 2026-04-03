import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { LeaderboardEntry, Position } from "../types.js";

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "positions.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  initTelegramUsersTable(_db);

  return _db;
}

function initTelegramUsersTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_users (
      user_id INTEGER PRIMARY KEY NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      updated_at INTEGER NOT NULL
    );
  `);
}

export type CachedTelegramUser = {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** Remember names from any update (getChat may fail if user blocked the bot). */
export function upsertTelegramUser(from: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}): void {
  if (!from?.id) return;
  getDb()
    .prepare(
      `
INSERT INTO telegram_users (user_id, username, first_name, last_name, updated_at)
VALUES (@id, @username, @first_name, @last_name, @updated_at)
ON CONFLICT(user_id) DO UPDATE SET
  username = excluded.username,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  updated_at = excluded.updated_at
`,
    )
    .run({
      id: from.id,
      username: from.username ?? null,
      first_name: from.first_name ?? null,
      last_name: from.last_name ?? null,
      updated_at: Date.now(),
    });
}

export function getCachedTelegramUser(
  userId: number,
): CachedTelegramUser | null {
  const row = getDb()
    .prepare(`SELECT * FROM telegram_users WHERE user_id = ?`)
    .get(userId) as
    | {
        user_id: number;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    mint TEXT NOT NULL,
    symbol TEXT NOT NULL DEFAULT 'UNKNOWN',
    name TEXT NOT NULL DEFAULT '',
    entry_price REAL NOT NULL,
    entry_time INTEGER NOT NULL,
    virtual_usd REAL NOT NULL DEFAULT 100,
    token_amount_raw TEXT NOT NULL DEFAULT '0',
    exit_price REAL,
    exit_time INTEGER,
    exit_usd REAL,
    pnl_usd REAL,
    pnl_percent REAL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    exit_reason TEXT,
    current_price REAL,
    last_updated INTEGER,
    opened_by_user_id INTEGER,
    opened_by_username TEXT
    );
    `);
  migratePositionsColumns(db);
}

function migratePositionsColumns(db: Database.Database): void {
  const cols = db
    .prepare("PRAGMA table_info(positions)")
    .all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("opened_by_user_id")) {
    db.exec("ALTER TABLE positions ADD COLUMN opened_by_user_id INTEGER");
  }
  if (!names.has("opened_by_username")) {
    db.exec("ALTER TABLE positions ADD COLUMN opened_by_username TEXT");
  }
}

export function createPosition(pos: Omit<Position, "status">): Position {
  const db = getDb();
  const position: Position = { ...pos, status: "OPEN" };

  db.prepare(
    `
  INSERT INTO positions (
id, chat_id,  mint, symbol, name, entry_price, entry_time, virtual_usd, token_amount_raw, status, current_price, last_updated, opened_by_user_id, opened_by_username) VALUES (
@id, @chat_id, @mint, @symbol, @name, @entryPrice, @entryTime, @virtualUsd, @tokenAmountRaw, @status, @currentPrice, @lastUpdated, @openedByUserId, @openedByUsername
)
  `,
  ).run({
    id: position.id,
    chat_id: position.chatId,
    mint: position.mint,
    symbol: position.symbol,
    name: position.name,
    entryPrice: position.entryPrice,
    entryTime: position.entryTime,
    virtualUsd: position.virtualUsd,
    tokenAmountRaw: position.tokenAmountRaw,
    status: position.status,
    currentPrice: position.currentPrice ?? position.entryPrice,
    lastUpdated: position.lastUpdated ?? Date.now(),
    openedByUserId: position.openedByUserId ?? null,
    openedByUsername: position.openedByUsername ?? null,
  });
  return position;
}

export function updatePositionPrice(id: string, currentPrice: number): void {
  getDb()
    .prepare(
      `UPDATE positions SET current_price = ?, last_updated = ? WHERE id = ?`,
    )
    .run(currentPrice, Date.now(), id);
}

export function closePosition(
  id: string,
  exitPrice: number,
  exitUsd: number,
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "MANUAL",
): Position | null {
  const pos = getPositionById(id);
  if (!pos) return null;

  const pnlUsd = exitUsd - pos.virtualUsd;
  const pnlPercent = (pnlUsd / pos.virtualUsd) * 100;

  getDb()
    .prepare(
      `
  UPDATE positions
 SET exit_price = ?, exit_time = ?, exit_usd = ?, pnl_usd = ?, pnl_percent = ?, status = 'CLOSED', exit_reason = ?, last_updated = ? where id = ?
  `,
    )
    .run(
      exitPrice,
      Date.now(),
      exitUsd,
      pnlUsd,
      pnlPercent,
      exitReason,
      Date.now(),
      id,
    );

  return getPositionById(id);
}

export function getPositionById(id: string): Position | null {
  const row = getDb()
    .prepare("SELECT * FROM positions WHERE id = ?")
    .get(id) as any;
  return row ? rowToPosition(row) : null;
}

export function getPositionByIdForChat(
  id: string,
  chatId: string,
): Position | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM positions WHERE id = ? AND chat_id = ?",
    )
    .get(id, Number(chatId)) as any;
  return row ? rowToPosition(row) : null;
}

export function getOpenPositionByMint(mint: string): Position | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM positions WHERE mint = ? AND status = 'OPEN' LIMIT 1`,
    )
    .get(mint) as any;

  return row ? rowToPosition(row) : null;
}

/** Same mint can be open in different chats — scope duplicate check to this chat. */
export function getOpenPositionByMintForChat(
  mint: string,
  chatId: string,
): Position | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM positions WHERE mint = ? AND chat_id = ? AND status = 'OPEN' LIMIT 1`,
    )
    .get(mint, Number(chatId)) as any;

  return row ? rowToPosition(row) : null;
}

export function getAllOpenPositions(): Position[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM positions WHERE status = 'OPEN' ORDER BY entry_time ASC`,
      )
      .all() as any[]
  ).map(rowToPosition);
}

export function getOpenPositionsForChat(chatId: string): Position[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM positions WHERE status = 'OPEN' AND chat_id = ? ORDER BY entry_time ASC`,
      )
      .all(Number(chatId)) as any[]
  ).map(rowToPosition);
}

export function getAllClosedPositions(): Position[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM positions WHERE status = 'CLOSED' ORDER BY exit_time DESC`,
      )
      .all() as any[]
  ).map(rowToPosition);
}

export function getClosedPositionsForChat(chatId: string): Position[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM positions WHERE status = 'CLOSED' AND chat_id = ? ORDER BY exit_time DESC`,
      )
      .all(Number(chatId)) as any[]
  ).map(rowToPosition);
}

/**
 * Rank traders bot-wide by realised P&L (closed positions only, all chats).
 * Rows with `opened_by_user_id` merge by user; legacy rows split by `chat_id`
 * (private chats → one row per user; group legacy → one row per group).
 */
export function getLeaderboardGlobal(): LeaderboardEntry[] {
  const rows = getDb()
    .prepare(
      `
SELECT
  COALESCE(opened_by_user_id, chat_id) AS bucketKey,
  MAX(opened_by_user_id) AS openedByUserId,
  MAX(opened_by_username) AS username,
  SUM(pnl_usd) AS realisedPnl,
  SUM(CASE WHEN pnl_usd > 0 THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN pnl_usd <= 0 THEN 1 ELSE 0 END) AS losses,
  COUNT(*) AS trades
FROM positions
WHERE status = 'CLOSED' AND pnl_usd IS NOT NULL
GROUP BY COALESCE(opened_by_user_id, chat_id)
ORDER BY realisedPnl DESC
`,
    )
    .all() as {
    bucketKey: number;
    openedByUserId: number | null;
    username: string | null;
    realisedPnl: number;
    wins: number;
    losses: number;
    trades: number;
  }[];

  return rows.map((r) => ({
    bucketKey: r.bucketKey,
    openedByUserId: r.openedByUserId,
    username: r.username,
    realisedPnl: r.realisedPnl,
    wins: r.wins,
    losses: r.losses,
    trades: r.trades,
  }));
}

function rowToPosition(row: any): Position {
  return {
    id: row.id,
    chatId: String(row.chat_id),
    mint: row.mint,
    symbol: row.symbol,
    name: row.name,
    entryPrice: row.entry_price,
    entryTime: row.entry_time,
    virtualUsd: row.virtual_usd,
    tokenAmountRaw: row.token_amount_raw,
    exitPrice: row.exit_price ?? undefined,
    exitTime: row.exit_time ?? undefined,
    exitUsd: row.exit_usd ?? undefined,
    pnlUsd: row.pnl_usd ?? undefined,
    pnlPercent: row.pnl_percent ?? undefined,
    status: row.status,
    exitReason: row.exit_reason ?? undefined,
    currentPrice: row.current_price ?? undefined,
    lastUpdated: row.last_updated ?? undefined,
    openedByUserId: row.opened_by_user_id ?? null,
    openedByUsername: row.opened_by_username ?? null,
  };
}
