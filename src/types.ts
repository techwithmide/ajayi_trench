/**
 * Current strategy is `trench_60` (TP +60% / SL −40%).
 * Keep legacy ids for old DB rows.
 */
export type StrategyProfileId = "trench_60" | "trench_100" | "trench_30";

// POSITION
export interface Position {
  id: string;
  chatId: string;
  mint: string;
  symbol: string;
  name: string;
  entryPrice: number;
  entryTime: number;
  virtualUsd: number;

  /** Raw SPL token units as a string to avoid precision loss */
  tokenAmountRaw: string;
  exitPrice?: number;
  exitTime?: number;
  exitUsd?: number;
  pnlUsd?: number;
  pnlPercent?: number;
  status: "OPEN" | "CLOSED";
  exitReason?: "TAKE_PROFIT" | "STOP_LOSS" | "MANUAL";
  currentPrice?: number;
  lastUpdated?: number;
  /** Telegram user who opened the trade (for per-chat leaderboard). */
  openedByUserId?: number | null;
  openedByUsername?: string | null;
  /** Price move vs entry to trigger TP (e.g. 0.6 = +60%). */
  takeProfitThreshold: number;
  /** Negative fraction for SL (e.g. -0.4 = −40%). */
  stopLossThreshold: number;
  strategyProfileId: StrategyProfileId;
}

/** Aggregated realised stats per trader (closed positions only). */
export interface LeaderboardEntry {
  /**
   * Group key: `opened_by_user_id` when set; otherwise `chat_id` for legacy rows
   * (splits private DMs per user; group legacy stays one row per group).
   */
  bucketKey: number;
  openedByUserId: number | null;
  username: string | null;
  realisedPnl: number;
  wins: number;
  losses: number;
  trades: number;
}

// TOKEN
export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
  /** DexScreener sometimes provides one or both; optional. */
  marketCap?: number;
  fdv?: number;
}

// JUPITER
export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: number | string;
  routePlan: JupiterRoutePlan[];
}

export interface JupiterRoutePlan {
  swapInfo: {
    label?: string;
    ammKey?: string;
  };
}

export interface SimulatedTrade {
  inputAmountRaw: string;
  outputAmountRaw: string;
  outputUsd: number;
  priceImpactPct: number;
  route: string;
}
