import { simulateBuy, simulateSell } from "./simulation/jupiter.js";
async function main() {
    // Example meme token (you can replace this)
    const tokenMint = "6KByfCna35oaFJ6gXAM8XmX7YxCnRqRvYqczcU2Apump"; // MOON
    console.log("🚀 Simulating BUY (USDC → TOKEN)...");
    const buy = await simulateBuy(tokenMint, 100);
    if (!buy) {
        console.log("❌ Buy simulation failed");
        return;
    }
    console.log("✅ BUY RESULT:");
    console.log(buy);
    console.log("\n🔄 Simulating SELL (TOKEN → USDC)...");
    const sell = await simulateSell(tokenMint, buy.outputAmountRaw);
    if (!sell) {
        console.log("❌ Sell simulation failed");
        return;
    }
    console.log("✅ SELL RESULT:");
    console.log(sell);
    // 🔥 Calculate round-trip result
    const finalUsd = sell.outputUsd;
    const pnl = finalUsd - buy.outputUsd;
    const pnlPct = (pnl / buy.outputUsd) * 100;
    console.log("\n📊 ROUND TRIP SUMMARY:");
    console.log({
        startUsd: buy.outputUsd,
        endUsd: finalUsd,
        pnl,
        pnlPct,
    });
}
main().catch(console.error);
//# sourceMappingURL=testJupiter.js.map