const QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SLIPPAGE_BPS = 300;
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
        const data = await res.json();
        return {
            inputAmountRaw,
            outputAmountRaw: data.outAmount,
            outputUsd: parseFloat(data.swapUsdValue ?? usdAmount.toString()),
            priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
            route: buildRouteLabel(data),
        };
    }
    catch (err) {
        console.error("[Jupiter] simulateBuy failed: ", err?.cause ?? err?.message ?? err);
    }
    return null;
}
export async function simulateSell(tokenMint, tokenAmountRaw) {
    if (tokenAmountRaw === "0")
        return null;
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
        const data = await res.json();
        return {
            inputAmountRaw,
            outputAmountRaw: data.outAmount,
            outputUsd: parseFloat(data.swapUsdValue ?? inputAmountRaw.toString()),
            priceImpactPct: parseFloat(String(data.priceImpactPct ?? 0)),
            route: buildRouteLabel(data),
        };
    }
    catch (err) {
        console.error("[Jupiter] simulateBuy failed: ", err?.cause ?? err?.message ?? err);
    }
    return null;
}
function buildRouteLabel(quote) {
    return (quote.routePlan
        ?.map((r) => r.swapInfo?.label ?? r.swapInfo?.ammKey?.slice(0, 8))
        .filter(Boolean)
        .join("→") || "Direct");
}
//# sourceMappingURL=lite-jupiter.js.map