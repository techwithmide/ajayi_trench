import { fetchTokenInfo, fetchCurrentPrice, batchFetchPrices } from "./price/index.js";
const MINTS = {
    ANIME: "82MmG1uH2BWLyoU7VCFYMohP9CT63q5paiKHAAAn3zWx",
    ROCKET: "4YiLHDR4B4pE4R5GUMA8HG8YunyeLwcobtEtvwMupump",
};
async function testFetchTokenInfo() {
    console.log("\n── fetchTokenInfo ──────────────────────────");
    const info = await fetchTokenInfo(MINTS.ANIME);
    console.log("ANIME TokenInfo:", info);
    const nullResult = await fetchTokenInfo("invalidmintaddress123");
    console.log("Invalid mint (expect null):", nullResult);
}
async function testFetchCurrentPrice() {
    console.log("\n── fetchCurrentPrice ───────────────────────");
    const price = await fetchCurrentPrice(MINTS.ROCKET);
    console.log("ROCKET price (USD):", price);
}
async function testBatchFetchPrices() {
    console.log("\n── batchFetchPrices ────────────────────────");
    const mints = Object.values(MINTS);
    const prices = await batchFetchPrices(mints);
    console.log("Batch result:");
    for (const [label, mint] of Object.entries(MINTS)) {
        const price = prices[mint];
        console.log(`  ${label}: ${price != null ? `$${price}` : "NOT FOUND"}`);
    }
    // Confirm no extra mints leaked in
    const returned = Object.keys(prices);
    const extras = returned.filter((m) => !mints.includes(m));
    if (extras.length > 0) {
        console.warn("  ⚠ Unexpected mints in result:", extras);
    }
    else {
        console.log("  ✓ No extra mints in result");
    }
}
async function main() {
    console.log("=== Price Service Tests ===");
    await testFetchTokenInfo();
    await testFetchCurrentPrice();
    await testBatchFetchPrices();
    console.log("\n=== Done ===");
}
main().catch(console.error);
//# sourceMappingURL=testDex.js.map