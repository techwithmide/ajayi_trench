import type { TokenInfo } from "../types.js";
/**
 * Fetch full token info for a single mint.
 * Tries DexSecreener first, falls back to GeckoTerminal.
 */
export declare function fetchTokenInfo(mint: string): Promise<TokenInfo | null>;
/**
 * Fetch the current USD price for a mint.
 */
export declare function fetchCurrentPrice(mint: string): Promise<number | null>;
/**
 * Batch-fetch prices for multiple open positions efficiently.
 * Uses DexSecreener batch endpoint (1 request per <30 mints).
 */
export declare function batchFetchPrices(mints: string[]): Promise<Record<string, number>>;
//# sourceMappingURL=index.d.ts.map