// =============================================================================
// IBAP Phase 10 — SmartWallet ABI + deployment registry.
//
// The Phase 9 SmartWallet (contracts/contracts/SmartWallet.sol) is the ONLY
// execution path for approved payments. These ABIs are the minimal interface
// the frontend needs to build + submit a validated execution batch.
//
// Deployment addresses mirror `contracts/deployments/localhost.json` — the
// record written by `npm --prefix contracts run deploy:wallet:local`.
// =============================================================================

import { resolveTokenAddress } from "../payment/execution";

export const SMART_WALLET_ABI = [
  "function executeTransaction(address target, uint256 value, bytes calldata data, uint256 _nonce) external returns (bool)",
  "function batchExecute(tuple(address target, uint256 value, bytes data)[] txs, uint256 _nonce) external returns (bool)",
  "function approveToken(address token, address spender, uint256 amount, uint256 _nonce) external returns (bool)",
  "function transferToken(address token, address to, uint256 amount, uint256 _nonce) external returns (bool)",
  "function nonce() external view returns (uint256)",
  "function owner() external view returns (address)",
  "function getBalance() external view returns (uint256)",
  "function getTokenBalance(address token) external view returns (uint256)",
  "function authorizedExecutors(address) external view returns (bool)",
] as const;

export const ERC20_MIN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

// -----------------------------------------------------------------------------
// Deployment registry
// -----------------------------------------------------------------------------

export interface SmartWalletDeployment {
  smartWallet: string;
  /** Mock settlement token deployed alongside the wallet (Phase 9 script). */
  mockUSDC: string;
  nativeSymbol: string;
}

/**
 * Where the SmartWallet is known to be deployed. Only localhost (31337) has a
 * real Phase 9 deployment by default. Mainnet placeholders are intentionally
 * left out — an approved plan on an un-deployed chain fails fast with
 * NOT_DEPLOYED instead of silently using an EOA transfer.
 */
export const SMART_WALLET_DEPLOYMENTS: Record<number, SmartWalletDeployment> = {
  31337: {
    smartWallet: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    mockUSDC: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    nativeSymbol: "ETH",
  },
};

/** Return the SmartWallet deployment for a chain, or null if not deployed. */
export function getSmartWalletDeployment(chainId: number | null | undefined): SmartWalletDeployment | null {
  if (!chainId) return null;
  return SMART_WALLET_DEPLOYMENTS[chainId] ?? null;
}

/**
 * Resolve an ERC20 address for SmartWallet execution.
 * On localhost (31337) USDC resolves to the Phase 9 deployment's MockERC20
 * (NOT the Phase 3/4 token registry — the wallet only holds mUSDC there).
 * Other tokens fall back to the shared Phase 4 registry.
 */
export function resolveExecutionTokenAddress(
  chainId: number | null | undefined,
  asset: string | null | undefined
): string | null {
  if (!chainId || !asset) return null;
  const upper = asset.toUpperCase();
  const deployment = getSmartWalletDeployment(chainId);
  if (upper === "USDC" && deployment) {
    return deployment.mockUSDC;
  }
  return resolveTokenAddress(chainId, upper);
}

/** Decimals for a settlement asset on a chain (USDC/USDT = 6, native = 18). */
export function resolveTokenDecimals(chainId: number | null | undefined, asset: string | null | undefined): number {
  const upper = (asset || "").toUpperCase();
  if (upper === "USDC" || upper === "USDT") return 6;
  if (upper === "ETH" || upper === "POL" || upper === "MATIC") return 18;
  // Local hardhat mock tokens are minted with 6 decimals.
  if (chainId === 31337) return 6;
  return 18;
}

/** Native asset check (used to decide transferToken vs executeTransaction). */
export function isNativeAsset(asset: string | null | undefined): boolean {
  const upper = (asset || "").toUpperCase();
  return upper === "ETH" || upper === "POL" || upper === "MATIC";
}
