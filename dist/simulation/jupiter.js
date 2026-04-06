import dotenv from "dotenv";
dotenv.config();
// ✅ Jupiter migrated away from quote-api.jup.ag — this is the current endpoint
const QUOTE_URL = "https://api.jup.ag/swap/v1/quote";
const API_KEY = process.env.JUPITER_API_KEY ?? "";
if (!API_KEY) {
    throw new Error("JUPITER_API_KEY is not set in .env");
}
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS = 300; // 3%
export async function simulateBuy(tokenMint, usdAmount = 100) {
    const inputAmountRaw = Math.floor(usdAmount * 10 ** USDC_DECIMALS).toString();
    try {
        const params = new URLSearchParams({
            inputMint: USDC_MINT,
            outputMint: tokenMint,
            amount: inputAmountRaw,
            slippageBps: SLIPPAGE_BPS.toString(),
            onlyDirectRoutes: "false",
        });
        const res = await fetch(`${QUOTE_URL}?${params.toString()}`, {
            headers: { "x-api-key": API_KEY },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const data = await res.json();
        return {
            inputAmountRaw,
            outputAmountRaw: data.outAmount,
            outputUsd: usdAmount,
            priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
            route: buildRouteLabel(data),
        };
    }
    catch (err) {
        console.error("[Jupiter] simulateBuy failed:", err?.message, err?.cause);
        return null;
    }
}
export async function simulateSell(tokenMint, tokenAmountRaw) {
    try {
        const params = new URLSearchParams({
            inputMint: tokenMint,
            outputMint: USDC_MINT,
            amount: tokenAmountRaw,
            slippageBps: SLIPPAGE_BPS.toString(),
        });
        const res = await fetch(`${QUOTE_URL}?${params.toString()}`, {
            headers: { "x-api-key": API_KEY },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const data = await res.json();
        return {
            inputAmountRaw: tokenAmountRaw,
            outputAmountRaw: data.outAmount,
            outputUsd: Number(data.outAmount) / 10 ** USDC_DECIMALS,
            priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
            route: buildRouteLabel(data),
        };
    }
    catch (err) {
        console.error("[Jupiter] simulateSell failed:", err?.message, err?.cause);
        return null;
    }
}
function buildRouteLabel(quote) {
    return (quote.routePlan
        ?.map((r) => r.swapInfo?.label ?? r.swapInfo?.ammKey?.slice(0, 8))
        .filter(Boolean)
        .join(" → ") || "Direct");
}
//# sourceMappingURL=jupiter.js.map