-- Migration: 20260822000000_compliance_layer.sql
-- Description: DPT Treasury Compliance Layer — persistence.
--
-- Extends the existing payment pipeline (payment_requests -> intents ->
-- payment_plans -> route_options -> risk_assessments -> approvals -> txns ->
-- audit_logs) with the compliance models that sit BETWEEN the user's
-- transaction intent and blockchain execution:
--
--   compliance_counterparties      simulated counterparty profiles / screening
--   compliance_monitoring_events   transaction monitoring signals
--   compliance_policy_results      deterministic policy evaluation results
--   compliance_travel_rule         simulated Travel Rule workflow records
--   compliance_audit_log           comprehensive compliance audit trail
--   compliance_portfolio_snapshots DPT portfolio monitoring snapshots
--
-- The existing `audit_logs` table (generic event_type/description/meta) is
-- KEPT and reused for generic operational events. This new table captures the
-- full, queryable compliance decision record so anyone can answer
-- "why was this transfer approved or blocked?"
--
-- All compliance data is SIMULATED for this prototype (no real sanctions
-- provider / KYC / Travel Rule network connectivity).
-- =============================================================================

-- 1. COUNTERPARTIES (simulated screening profiles)
CREATE TABLE IF NOT EXISTS public.compliance_counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    name TEXT,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
        CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED')),
    sanctions_screened BOOLEAN NOT NULL DEFAULT FALSE,
    wallet_risk TEXT NOT NULL DEFAULT 'MEDIUM'
        CHECK (wallet_risk IN ('LOW', 'MEDIUM', 'HIGH')),
    wallet_age_days INT NOT NULL DEFAULT 0,
    txn_history_count INT NOT NULL DEFAULT 0,
    avg_txn_size_usd NUMERIC NOT NULL DEFAULT 0,
    recent_daily_txns INT NOT NULL DEFAULT 0,
    suspicious_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_known_vendor BOOLEAN NOT NULL DEFAULT FALSE,
    risk_score NUMERIC NOT NULL DEFAULT 0,
    screening_verdict TEXT NOT NULL DEFAULT 'REVIEW'
        CHECK (screening_verdict IN ('PASS', 'REVIEW', 'BLOCK')),
    note TEXT,
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. MONITORING EVENTS (transaction monitoring signals)
CREATE TABLE IF NOT EXISTS public.compliance_monitoring_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    txn_reference TEXT,
    signal_code TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    asset TEXT,
    amount_usd NUMERIC,
    network TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. POLICY RESULTS (deterministic policy evaluations)
CREATE TABLE IF NOT EXISTS public.compliance_policy_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    txn_reference TEXT,
    policy_id TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    category TEXT,
    passed BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    effect TEXT NOT NULL CHECK (effect IN ('ALLOW', 'REVIEW', 'BLOCK')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TRAVEL RULE RECORDS (simulated Travel Rule workflow)
CREATE TABLE IF NOT EXISTS public.compliance_travel_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    txn_reference TEXT,
    amount_usd NUMERIC,
    asset TEXT,
    status TEXT NOT NULL CHECK (status IN ('READY', 'INCOMPLETE')),
    present_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    effect TEXT NOT NULL CHECK (effect IN ('ALLOW', 'REVIEW', 'BLOCK')),
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COMPLIANCE AUDIT LOG (the comprehensive compliance decision record)
CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    txn_reference TEXT NOT NULL,
    customer_id TEXT,
    intent TEXT,
    recipient TEXT,
    recipient_address TEXT,
    asset TEXT,
    amount_usd NUMERIC,
    screening_verdict TEXT,
    screening_risk_score NUMERIC,
    monitoring_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk_score NUMERIC,
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    policy_decision TEXT CHECK (policy_decision IN ('ALLOW', 'REVIEW', 'BLOCK')),
    policy_violations JSONB NOT NULL DEFAULT '[]'::jsonb,
    travel_rule_status TEXT,
    travel_rule_missing JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'REVIEW', 'BLOCK')),
    reviewer TEXT,
    execution_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    tx_hash TEXT,
    ai_explanation TEXT,
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PORTFOLIO SNAPSHOTS (DPT portfolio monitoring)
CREATE TABLE IF NOT EXISTS public.compliance_portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    total_value_usd NUMERIC NOT NULL DEFAULT 0,
    stablecoin_share NUMERIC NOT NULL DEFAULT 0,
    dpt_share NUMERIC NOT NULL DEFAULT 0,
    max_concentration NUMERIC NOT NULL DEFAULT 0,
    max_concentration_asset TEXT,
    portfolio_risk TEXT NOT NULL DEFAULT 'LOW'
        CHECK (portfolio_risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    assets JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_compliance_audit_business ON public.compliance_audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_txn ON public.compliance_audit_log(txn_reference);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_decision ON public.compliance_audit_log(decision);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_risk ON public.compliance_audit_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_timestamp ON public.compliance_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_monitoring_business ON public.compliance_monitoring_events(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policy_business ON public.compliance_policy_results(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_travel_business ON public.compliance_travel_rule(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_portfolio_business ON public.compliance_portfolio_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_counterparties_address ON public.compliance_counterparties(wallet_address);

-- =============================================================================
-- TRIGGERS (auto updated_at on counterparties)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_compliance_counterparties ON public.compliance_counterparties;
CREATE TRIGGER set_updated_at_compliance_counterparties
    BEFORE UPDATE ON public.compliance_counterparties
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (service-role writes, mirroring the other operational
-- tables — see yield_positions / phase 10-11 patterns)
-- =============================================================================

ALTER TABLE public.compliance_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_policy_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_travel_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages compliance counterparties"
    ON public.compliance_counterparties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages compliance monitoring events"
    ON public.compliance_monitoring_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages compliance policy results"
    ON public.compliance_policy_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages compliance travel rule"
    ON public.compliance_travel_rule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages compliance audit log"
    ON public.compliance_audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages compliance portfolio snapshots"
    ON public.compliance_portfolio_snapshots FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.compliance_audit_log IS
  'Compliance decision audit trail. Every transfer records screening, monitoring,
   risk, policy, travel rule, final decision and execution status so the question
   "why was this transfer approved or blocked?" is always answerable.';
