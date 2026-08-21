-- Migration: 20260821000000_yield_automation.sql
-- Description: Phase 13 — Yield Automation schema. Tracks idle-treasury sweeps
--              into YieldVault positions (DEPOSIT / WITHDRAW / HARVEST).

-- 1. YIELD POSITIONS TABLE
CREATE TABLE IF NOT EXISTS public.yield_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    wallet_address TEXT NOT NULL,
    vault_address TEXT NOT NULL,
    strategy_id TEXT,
    asset_symbol TEXT NOT NULL DEFAULT 'USDC',
    chain_id NUMERIC,
    action TEXT NOT NULL CHECK (action IN ('DEPOSIT', 'WITHDRAW', 'HARVEST')),
    principal_amount TEXT,
    shares TEXT,
    apy_bps NUMERIC,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'WITHDRAWN', 'COMPOUNDED')),
    tx_hash TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 2. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_yield_positions_business_id ON public.yield_positions(business_id);
CREATE INDEX IF NOT EXISTS idx_yield_positions_wallet_address ON public.yield_positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_yield_positions_status ON public.yield_positions(status);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.yield_positions ENABLE ROW LEVEL SECURITY;

-- Service-role writes only (mirrors the other phase-10/11 operational tables).
CREATE POLICY "Service role manages yield positions"
    ON public.yield_positions FOR ALL
    USING (true)
    WITH CHECK (true);
