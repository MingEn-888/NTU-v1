-- Migration: 20260810000000_phase10_execution.sql
-- Description: Phase 10 IBAP Human Approval & Blockchain Execution — persistence.
--
-- Extends the Phase 2 pipeline (payment_requests -> intents -> payment_plans ->
-- route_options -> payment_steps -> risk_assessments -> approvals -> txns ->
-- audit_logs) so an approved, risk-checked plan can be executed through the
-- Phase 9 SmartWallet with a full on-chain status lifecycle:
--     SUBMITTED -> PENDING -> CONFIRMED | FAILED
--
-- The txns table now mirrors the ExecutionStatus lifecycle and captures the
-- smart wallet address + typed failure (error_code / error_message) so every
-- execution is fully auditable: payment req, selected route, approval,
-- txn hash, status, gas used, gas cost, timestamps and explorer URL.
-- =============================================================================

-- 1. Expand the txn status lifecycle to include SUBMITTED (broadcast) and
--    keep PENDING (mempool) / CONFIRMED (mined ok) / FAILED (reverted/rejected).
ALTER TABLE public.txns
    DROP CONSTRAINT IF EXISTS txns_status_check;

ALTER TABLE public.txns
    ADD CONSTRAINT txns_status_check
    CHECK (status IN ('SUBMITTED', 'PENDING', 'CONFIRMED', 'FAILED'));

-- 2. Extra audit columns for Phase 10 executions.
ALTER TABLE public.txns ADD COLUMN IF NOT EXISTS smart_wallet_address TEXT;
ALTER TABLE public.txns ADD COLUMN IF NOT EXISTS execution_plan_id UUID;
ALTER TABLE public.txns ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE public.txns ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 3. Index for execution lookups by hash/status (audit + analytics).
CREATE INDEX IF NOT EXISTS idx_txns_status ON public.txns(status);
CREATE INDEX IF NOT EXISTS idx_txns_created_at ON public.txns(created_at DESC);

-- 4. Approval note (optional operator remark captured at the approval gate).
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS approved_by_address TEXT;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS note TEXT;

-- 5. Comment for clarity.
COMMENT ON TABLE public.txns IS
  'Phase 10 execution records. Status lifecycle: SUBMITTED -> PENDING -> CONFIRMED | FAILED.';
