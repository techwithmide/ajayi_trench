import type { JupiterQuote, SimulatedTrade } from "../types";

const QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS = 300; // 3% - reasonable for new tokens

export async function simulateBuy(
  tokenMint: string,
  usdAmount = 100,
): Promise<SimulatedTrade | null> {
  const inputAmountRaw = Math.floor(usdAmount * 10 ** USDC_DECIMALS).toString();

  try {
    const params = new URLSearchParams({
      inputMint: USDC_MINT,
      outputMint: tokenMint,
      amount: inputAmountRaw,
      slippageBps: SLIPPAGE_BPS.toString(),
      onlyDirectRoutes: "false",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(`${QUOTE_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data: JupiterQuote = await res.json();

    return {
      inputAmountRaw,
      outputAmountRaw: data.outAmount,
      outputUsd: usdAmount,
      priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
      route: buildRouteLabel(data),
    };
  } catch (err: any) {
    const detail = err?.message || "Unknown error";
    console.error("[Jupiter] simulateBuy failed:", detail);
    return null;
  }
}

function buildRouteLabel(quote: JupiterQuote): string {
  return (
    quote.routePlan
      ?.map((r) => r.swapInfo?.label ?? r.swapInfo?.ammKey?.slice(0, 8))
      .filter(Boolean)
      .join("→") || "Direct"
  );
}
