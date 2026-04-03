import { fetchDexScreenerPrices } from "./dexscreener";
import { fetchGeckoTerminalPrices } from "./geckoterminal";
import type { TokenInfo } from "../types";

/**
 * Fetch full token info for a single mint.
 * Tries DexSecreener first, falls back to GeckoTerminal.
 */
export async function fetchTokenInfo(mint: string): Promise<TokenInfo | null> {
  const result = await fetchDexScreenerPrices([mint]);
  if (result[mint]) return result[mint];

  console.log(
    `[Price] DexScreener miss for ${mint.slice(0, 8)}... - trying GeckoTerminal`,
  );
  const gecko = await fetchGeckoTerminalPrices([mint]);

  if (gecko[mint]) {
    return {
      mint,
      symbol: "UNKNOWN",
      name: "",
      priceUsd: gecko[mint],
    };
  }

  return null;
}

/**
 * Fetch the current USD price for a mint.
 */
export async function fetchCurrentPrice(mint: string): Promise<number | null> {
  const info = await fetchTokenInfo(mint);
  return info?.priceUsd ?? null;
}

/**
 * Batch-fetch prices for multiple open positions efficiently.
 * Uses DexSecreener batch endpoint (1 request per <30 mints).
 */
export async function batchFetchPrices(
  mints: string[],
): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  const prices: Record<string, number> = {};

  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) {
    chunks.push(mints.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const result = await fetchDexScreenerPrices(chunk);
    for (const [mint, info] of Object.entries(result)) {
      prices[mint] = info.priceUsd;
    }
  }

  const missed = mints.filter((m) => !prices[m]);
  if (missed.length > 0) {
    const gecko = await fetchGeckoTerminalPrices(missed);
    Object.assign(prices, gecko);
  }

  return prices;
}
