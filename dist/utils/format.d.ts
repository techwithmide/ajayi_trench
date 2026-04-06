export declare function formatUsd(amount: number): string;
export declare function formatPnL(pnl: number): string;
export declare function formatPercent(pct: number): string;
/** TP/SL from price-change fractions (e.g. tp=0.6 → +60%, sl=-0.4 → −40%). */
export declare function formatTpSlFromFractions(tp: number, sl: number): string;
export declare function formatDuration(startMs: number, endMs: number): string;
export declare function formatTimestamp(ms: number): string;
export declare function isSolanaAddress(str: string): boolean;
export declare function truncateAddress(address: string): string;
export declare function generateId(): string;
export declare function escapeHtml(s: string): string;
//# sourceMappingURL=format.d.ts.map