import { simulateBuy } from "./simulation/lite-jupiter";
const SCENARIOS = [
    {
        label: "SOL (well-known, deep liquidity)",
        mint: "So11111111111111111111111111111111111111112",
        usd: 100,
    },
    {
        label: "BONK (high-volume meme token)",
        mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        usd: 100,
    },
    {
        label: "Small buy - $10",
        mint: "So11111111111111111111111111111111111111112",
        usd: 10,
    },
    {
        label: "Large buy - $1000 (expect higher price impact)",
        mint: "So11111111111111111111111111111111111111112",
        usd: 1000,
    },
];
async function main() {
    console.log("=== JUPITER simulateBuy smoke-check ===\n");
    for (const s of SCENARIOS) {
        process.stdout.write(`${s.label}...`);
        const result = await simulateBuy(s.mint, s.usd);
        if (!result) {
            console.log("returned null");
            continue;
        }
        const tokensOut = (Number(result.outputAmountRaw) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 });
        console.log("✅");
        console.log(`   Input: $${s.usd} USDC (${result.inputAmountRaw} raw)`);
        console.log(`   Output raw: ${result.outputAmountRaw}`);
        console.log(`   Tokens out: ~${tokensOut} (assumes 9 decimal - adjust if needed`);
        console.log(`   Price impact: ${result.priceImpactPct.toFixed(4)}%`);
        console.log(`   Route: ${result.route}`);
        console.log();
    }
}
main().catch((err) => {
    console.error("Runner crashed: ", err);
    process.exit(1);
});
//# sourceMappingURL=run-simulation.js.map