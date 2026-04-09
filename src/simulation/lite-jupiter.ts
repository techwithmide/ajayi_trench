import type { SimulatedTrade } from "../types.js";

const QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS = 300;

interface JupiterLiteQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string | number;
  swapUsdValue?: string;
  routePlan?: {
    swapInfo?: {
      label?: string;
      ammKey?: string;
    };
    percent?: number;
  }[];
}

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

    const data: JupiterLiteQuote = await res.json();

    return {
      inputAmountRaw,
      outputAmountRaw: data.outAmount,
      outputUsd: parseFloat(data.swapUsdValue ?? usdAmount.toString()),
      priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
      route: buildRouteLabel(data),
    };
  } catch (err: any) {
    console.error(
      "[Jupiter] simulateBuy failed: ",
      err?.cause ?? err?.message ?? err,
    );
  }

  return null;
}

export async function simulateSell(
  tokenMint: string,
  tokenAmountRaw: string,
): Promise<SimulatedTrade | null> {
  if (tokenAmountRaw === "0") return null;
  const inputAmountRaw = Math.floor(Number(tokenAmountRaw)).toString();

  try {
    const params = new URLSearchParams({
      inputMint: tokenMint,
      outputMint: USDC_MINT,
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

    const data: JupiterLiteQuote = await res.json();

    return {
      inputAmountRaw,
      outputAmountRaw: data.outAmount,
      outputUsd: parseFloat(data.swapUsdValue ?? inputAmountRaw.toString()),
      priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
      route: buildRouteLabel(data),
    };
  } catch (err: any) {
    console.error(
      "[Jupiter] simulateSell failed: ",
      err?.cause ?? err?.message ?? err,
    );
  }
  return null;
}

/**
 * True if Jupiter returns a quote for selling this token amount to USDC (same endpoint as simulateSell).
 * Used to detect repeated “no route” / untradeable states without logging every failure.
 */
export async function probeSellQuote(
  tokenMint: string,
  tokenAmountRaw: string,
): Promise<boolean> {
  const raw = tokenAmountRaw.trim();
  if (raw === "0" || raw === "") return true;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return true;

  const inputAmountRaw = Math.floor(n).toString();

  try {
    const params = new URLSearchParams({
      inputMint: tokenMint,
      outputMint: USDC_MINT,
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

    if (!res.ok) return false;

    const data = (await res.json()) as JupiterLiteQuote;
    const out = data?.outAmount;
    return typeof out === "string" && out.length > 0 && out !== "0";
  } catch {
    return false;
  }
}

function buildRouteLabel(quote: JupiterLiteQuote): string {
  return (
    quote.routePlan
      ?.map((r) => r.swapInfo?.label ?? r.swapInfo?.ammKey?.slice(0, 8))
      .filter(Boolean)
      .join("→") || "Direct"
  );
}
