"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export interface Asset {
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue: number;
  chain: string;
}

export interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  icon: string;
  rpc?: string;
}

export interface BusinessProfile {
  id: string;
  business_name: string;
  default_chain: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TreasuryWallet {
  id: string;
  business_id: string;
  address: string;
  ens: string | null;
  chain_id: number;
  native_balance: number;
  updated_at: string;
}

const SUPPORTED_CHAINS: ChainConfig[] = [
  { id: 1, name: "Ethereum", symbol: "ETH", icon: "ethereum" },
  { id: 137, name: "Polygon", symbol: "POL", icon: "polygon" },
  { id: 42161, name: "Arbitrum", symbol: "ETH", icon: "arbitrum" },
  { id: 10, name: "Optimism", symbol: "ETH", icon: "optimism" },
  { id: 8453, name: "Base", symbol: "ETH", icon: "base" }
];

const ASSET_PRICES: Record<string, number> = {
  ETH: 1800.00,
  POL: 0.70,
  MATIC: 0.70,
  USDC: 1.00,
  USDT: 1.00
};

export function useTreasury(walletAddress: string | null, chainId: number | null, liveNativeBalance: string, liveTokenBalances: Record<string, string>) {
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [dbWallet, setDbWallet] = useState<TreasuryWallet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Address for fetching: default to seed treasury address if not connected
  const lookupAddress = useMemo(() => {
    return walletAddress || "0x3c44cdd470368a0623a22d2c4022878d3f9905e5";
  }, [walletAddress]);

  // Fetch business profile & registered treasury wallet
  const fetchBusinessData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business?address=${lookupAddress}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch business data");
      
      setBusinessProfile(data.businessProfile);
      setDbWallet(data.wallet);
    } catch (err: any) {
      console.error("Error loading treasury:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [lookupAddress]);

  // Associate connected wallet with the current business profile
  const associateWallet = useCallback(async () => {
    if (!businessProfile || !walletAddress || !chainId) {
      setError("Cannot associate: Business profile or active wallet missing");
      return;
    }

    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/business/associate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: businessProfile.id,
          address: walletAddress,
          chainId,
          nativeBalance: parseFloat(liveNativeBalance) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to associate wallet");
      
      setDbWallet(data.wallet);
      return data.wallet;
    } catch (err: any) {
      console.error("Error associating wallet:", err);
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [businessProfile, walletAddress, chainId, liveNativeBalance]);

  // Load business profile on load or wallet change
  useEffect(() => {
    fetchBusinessData();
  }, [fetchBusinessData]);

  // Compile Available Assets with Balances and Valuations
  const availableAssets = useMemo<Asset[]>(() => {
    const activeChainId = chainId || dbWallet?.chain_id || 137;
    const currentChain = SUPPORTED_CHAINS.find((c) => c.id === activeChainId) || SUPPORTED_CHAINS[1];
    
    // Determine native symbol and balances (live values if connected, otherwise DB seeded values)
    const nativeSymbol = currentChain.symbol;
    const nativeBal = walletAddress ? liveNativeBalance : (dbWallet?.native_balance?.toString() || "1250.50");
    const usdcBal = walletAddress ? liveTokenBalances.USDC : "25000.00";
    const usdtBal = walletAddress ? liveTokenBalances.USDT : "5000.00";

    const nativePrice = ASSET_PRICES[nativeSymbol] || 1.00;
    const nativeVal = (parseFloat(nativeBal) || 0) * nativePrice;
    const usdcVal = (parseFloat(usdcBal) || 0) * 1.0;
    const usdtVal = (parseFloat(usdtBal) || 0) * 1.0;

    return [
      {
        symbol: nativeSymbol,
        name: currentChain.name + " Native",
        decimals: 18,
        balance: nativeBal,
        usdValue: nativeVal,
        chain: currentChain.name
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        balance: usdcBal,
        usdValue: usdcVal,
        chain: currentChain.name
      },
      {
        symbol: "USDT",
        name: "Tether",
        decimals: 6,
        balance: usdtBal,
        usdValue: usdtVal,
        chain: currentChain.name
      }
    ];
  }, [walletAddress, chainId, dbWallet, liveNativeBalance, liveTokenBalances]);

  // Compile Token Balances Map
  const tokBalances = useMemo<Record<string, string>>(() => {
    const usdc = availableAssets.find((a) => a.symbol === "USDC")?.balance || "0.0";
    const usdt = availableAssets.find((a) => a.symbol === "USDT")?.balance || "0.0";
    return { USDC: usdc, USDT: usdt };
  }, [availableAssets]);

  // Native Gas Balance (Native balance on active chain)
  const nativeGasBalance = useMemo<string>(() => {
    return availableAssets[0]?.balance || "0.0";
  }, [availableAssets]);

  // Sum total estimated USD value
  const totalEstimatedUSDValue = useMemo<number>(() => {
    return availableAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
  }, [availableAssets]);

  // Financial Context object to be consumed by the AI routing system
  const treasuryContext = useMemo(() => {
    return {
      availableAssets,
      tokBalances,
      supportedChains: SUPPORTED_CHAINS,
      preferredChain: businessProfile?.default_chain || "polygon",
      nativeGasBalance,
      totalEstimatedUSDValue,
      associatedWalletAddress: dbWallet?.address || null,
      isWalletAssociated: !!dbWallet && dbWallet.address.toLowerCase() === walletAddress?.toLowerCase(),
    };
  }, [availableAssets, tokBalances, businessProfile, nativeGasBalance, totalEstimatedUSDValue, dbWallet, walletAddress]);

  return {
    businessProfile,
    dbWallet,
    isLoading,
    isSyncing,
    error,
    refreshTreasury: fetchBusinessData,
    associateWallet,
    availableAssets,
    tokBalances,
    nativeGasBalance,
    totalEstimatedUSDValue,
    supportedChains: SUPPORTED_CHAINS,
    preferredChain: businessProfile?.default_chain || "polygon",
    treasuryContext,
  };
}
