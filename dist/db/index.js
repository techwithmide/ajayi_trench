import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "positions.db");
let _db = null;
export function getDb() {
    if (_db)
        return _db;
    const dir = path.dirname(DB_PATH);
    fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    return _db;
}
function initSchema(db) {
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
    last_updated INTEGER
    );
    `);
}
export function createPosition(pos) {
    const db = getDb();
    const position = { ...pos, status: "OPEN" };
    db.prepare(`
  INSERT INTO positions (
id, chat_id,  mint, symbol, name, entry_price, entry_time, virtual_usd, token_amount_raw, status, current_price, last_updated) VALUES (
@id, @chat_id, @mint, @symbol, @name, @entryPrice, @entryTime, @virtualUsd, @tokenAmountRaw, @status, @currentPrice, @lastUpdated
)
  `).run({
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
    });
    return position;
}
export function updatePositionPrice(id, currentPrice) {
    getDb()
        .prepare(`UPDATE positions SET current_price = ?, last_updated = ? WHERE id = ?`)
        .run(currentPrice, Date.now(), id);
}
export function closePosition(id, exitPrice, exitUsd, exitReason) {
    const pos = getPositionById(id);
    if (!pos)
        return null;
    const pnlUsd = exitUsd - pos.virtualUsd;
    const pnlPercent = (pnlUsd / pos.virtualUsd) * 100;
    getDb()
        .prepare(`
  UPDATE positions
 SET exit_price = ?, exit_time = ?, exit_usd = ?, pnl_usd = ?, pnl_percent = ?, status = 'CLOSED', exit_reason = ?, last_updated = ? where id = ?
  `)
        .run(exitPrice, Date.now(), exitUsd, pnlUsd, pnlPercent, exitReason, Date.now(), id);
    return getPositionById(id);
}
export function getPositionById(id) {
    const row = getDb()
        .prepare("SELECT * FROM positions WHERE id = ?")
        .get(id);
    return row ? rowToPosition(row) : null;
}
export function getPositionByIdForChat(id, chatId) {
    const row = getDb()
        .prepare("SELECT * FROM positions WHERE id = ? AND chat_id = ?")
        .get(id, Number(chatId));
    return row ? rowToPosition(row) : null;
}
export function getOpenPositionByMint(mint) {
    const row = getDb()
        .prepare(`SELECT * FROM positions WHERE mint = ? AND status = 'OPEN' LIMIT 1`)
        .get(mint);
    return row ? rowToPosition(row) : null;
}
/** Same mint can be open in different chats — scope duplicate check to this chat. */
export function getOpenPositionByMintForChat(mint, chatId) {
    const row = getDb()
        .prepare(`SELECT * FROM positions WHERE mint = ? AND chat_id = ? AND status = 'OPEN' LIMIT 1`)
        .get(mint, Number(chatId));
    return row ? rowToPosition(row) : null;
}
export function getAllOpenPositions() {
    return getDb()
        .prepare(`SELECT * FROM positions WHERE status = 'OPEN' ORDER BY entry_time ASC`)
        .all().map(rowToPosition);
}
export function getOpenPositionsForChat(chatId) {
    return getDb()
        .prepare(`SELECT * FROM positions WHERE status = 'OPEN' AND chat_id = ? ORDER BY entry_time ASC`)
        .all(Number(chatId)).map(rowToPosition);
}
export function getAllClosedPositions() {
    return getDb()
        .prepare(`SELECT * FROM positions WHERE status = 'CLOSED' ORDER BY exit_time DESC`)
        .all().map(rowToPosition);
}
export function getClosedPositionsForChat(chatId) {
    return getDb()
        .prepare(`SELECT * FROM positions WHERE status = 'CLOSED' AND chat_id = ? ORDER BY exit_time DESC`)
        .all(Number(chatId)).map(rowToPosition);
}
function rowToPosition(row) {
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
    };
}
//# sourceMappingURL=index.js.map