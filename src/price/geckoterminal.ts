const BASE_URL =
  "https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price";

const CHUNK_SIZE = 30;
const CHUNK_DELAY_MS = 500;

export async function fetchGeckoTerminalPrices(
  mints: string[],
): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  const results: Record<string, number> = {};

  for (let i = 0; i < mints.length; i += CHUNK_SIZE) {
    const chunk = mints.slice(i, i + CHUNK_SIZE);

    try {
      const url = `${BASE_URL}/${chunk.join(",")}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await response.json();

      const prices: Record<string, string> =
        data?.data?.attributes?.token_prices ?? {};

      for (const [mint, price] of Object.entries(prices)) {
        const parsed = parseFloat(price);
        if (parsed > 0) results[mint] = parsed;
      }
    } catch (err: any) {
      console.error("[GeckoTerminal] Error: ", err.message);
    }

    if (i + CHUNK_SIZE < mints.length) {
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }

  return results;
}
