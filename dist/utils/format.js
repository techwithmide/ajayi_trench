export function formatUsd(amount) {
    if (amount >= 1)
        return `$${amount.toFixed(2)}`;
    if (amount >= 0.01)
        return `$${amount.toFixed(4)}`;
    return `$${amount.toFixed(8)}`;
}
export function formatPnL(pnl) {
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}${formatUsd(pnl)}`;
}
export function formatPercent(pct) {
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
}
export function formatDuration(startMs, endMs) {
    const diff = endMs - startMs;
    const totalMins = Math.floor(diff / 60_000);
    const hours = Math.floor(totalMins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d ${hours % 24}h`;
    if (hours > 0)
        return `${hours}h ${totalMins % 60}m`;
    if (totalMins > 0)
        return `${totalMins}m`;
    return "just now";
}
export function formatTimestamp(ms) {
    return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
export function isSolanaAddress(str) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str.trim());
}
export function truncateAddress(address) {
    return `${address.slice(0, 5)}...${address.slice(-4)}`;
}
export function generateId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `pos_${ts}_${rand}`;
}
//# sourceMappingURL=format.js.map