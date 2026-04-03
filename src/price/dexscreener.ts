import type { TokenInfo } from "../types.js";

const BASE_URL = "https://api.dexscreener.com/latest/dex/tokens";

let lastRequestAt = 0;
const MIN_GAP_MS = 500;

// ~120 req/min to stay under rate limit
async function throttle(): Promise<void> {
  const gap = Date.now() - lastRequestAt;
  if (gap < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
  }
  lastRequestAt = Date.now();
}

export async function fetchDexScreenerPrices(
  mints: string[],
  retries = 1,
): Promise<Record<string, TokenInfo>> {
  if (mints.length === 0) return {};

  await throttle();

  try {
    const url = `${BASE_URL}/${mints.join(",")}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!data.pairs || data.pairs.length === 0) return {};

    const mintSet = new Set(mints); // <-
    const result: Record<string, TokenInfo> = {};

    for (const pair of data.pairs) {
      if (pair.chainId !== "solana") continue;

      const mint: string = pair.baseToken?.address;
      if (!mint || !mintSet.has(mint)) continue;

      const priceUsd = parseFloat(pair.priceUsd || "0");
      if (!priceUsd) continue;

      const liquidity: number = pair.liquidity?.usd ?? 0;
      if (!result[mint] || liquidity > (result[mint].liquidity ?? 0)) {
        result[mint] = {
          mint,
          symbol: pair.baseToken.symbol || "UNKNOWN",
          name: pair.baseToken.name || "",
          priceUsd,
          liquidity,
          volume24h: pair.volume?.h24 ?? 0,
          priceChange24h: pair.priceChange?.h24 ?? 0,
        };
      }
    }

    return result;
  } catch (err: any) {
    if (err.response?.status === 429 && retries > 0) {
      console.warn(
        "[Dexscreener] Rate limited - waiting 3s before retrying retry...",
      );
      await new Promise((r) => setTimeout(r, 3_000));
      return fetchDexScreenerPrices(mints, retries - 1);
    }

    if (err.response?.status !== 404) {
      console.error("[DexScreener] Error:", err.message);
    }
    return {};
  }
}
