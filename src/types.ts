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
