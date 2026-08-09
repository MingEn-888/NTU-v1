// =============================================================================
// On-chain execution helpers for the payment operations agent.
// Resolves settlement assets to token addresses per chain and builds explorer
// URLs so the UI can render post-execution results.
// =============================================================================

export const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  1: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  137: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  42161: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  31337: {
    USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    USDT: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
};

const NATIVE_ASSETS = new Set(["ETH", "POL"]);

/** Return the ERC20 token address for an asset on a chain, or null if native. */
export function resolveTokenAddress(chainId: number | null, asset: string | null | undefined): string | null {
  if (!chainId || !asset) return null;
  if (NATIVE_ASSETS.has(asset.toUpperCase())) return null;
  return TOKEN_ADDRESSES[chainId]?.[asset.toUpperCase()] || null;
}

const EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
};

export function buildExplorerUrl(chainId: number | null, txHash: string): string | null {
  if (!chainId || !txHash) return null;
  const base = EXPLORERS[chainId];
  if (!base) return null; // e.g. local hardhat — no explorer
  return base + txHash;
}
