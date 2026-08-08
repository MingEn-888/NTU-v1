-- Migration: 20260201000000_ibap_schema.sql
-- Description: Complete Phase 2 IBAP Database Schema, Constraints, Triggers, and Row Level Security (RLS)
-- Agentic Payment Operations for Business: Payment Req -> AI Intent -> Payment Plan -> Route Options -> Risk Assessment -> Approval -> Execution -> Audit

-- Enable pgcrypto extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLES DEFINITIONS
-- =============================================================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT UNIQUE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BUSINESS PROFILES
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    default_chain TEXT NOT NULL DEFAULT 'polygon',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. WALLETS
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    ens TEXT,
    chain_id NUMERIC NOT NULL,
    native_balance NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PAYMENT REQUESTS
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    description TEXT,
    recipient_name TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL,
    requested_currency TEXT,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PLANNING', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    source TEXT NOT NULL DEFAULT 'DASHBOARD' CHECK (source IN ('DASHBOARD', 'CHAT', 'INTEGRATION')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INTENTS
CREATE TABLE IF NOT EXISTS public.intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    recipient TEXT NOT NULL,
    amount NUMERIC,
    currency TEXT,
    target_chain TEXT,
    due_date TIMESTAMPTZ,
    confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1.0),
    missing_information JSONB DEFAULT '[]'::jsonb,
    raw_input TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PAYMENT PLANS
CREATE TABLE IF NOT EXISTS public.payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
    selected_route_id UUID, -- Foreign Key added after route_options table definition
    total_estimated_gas NUMERIC NOT NULL DEFAULT 0,
    estimated_duration INT NOT NULL DEFAULT 0,
    savings NUMERIC NOT NULL DEFAULT 0,
    explanation TEXT,
    risk_score NUMERIC CHECK (risk_score >= 0 AND risk_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ROUTE OPTIONS
CREATE TABLE IF NOT EXISTS public.route_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    route_name TEXT NOT NULL,
    chain TEXT NOT NULL,
    estimated_gas NUMERIC NOT NULL DEFAULT 0,
    estimated_time INT NOT NULL DEFAULT 0,
    transaction_count INT NOT NULL DEFAULT 1,
    risk_score NUMERIC CHECK (risk_score >= 0 AND risk_score <= 100),
    total_score NUMERIC,
    savings NUMERIC NOT NULL DEFAULT 0,
    is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add Deferrable FK for Selected Route in Payment Plans
ALTER TABLE public.payment_plans
    DROP CONSTRAINT IF EXISTS fk_payment_plans_selected_route;

ALTER TABLE public.payment_plans
    ADD CONSTRAINT fk_payment_plans_selected_route
    FOREIGN KEY (selected_route_id)
    REFERENCES public.route_options(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- 8. PAYMENT STEPS
CREATE TABLE IF NOT EXISTS public.payment_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_chain TEXT,
    destination_chain TEXT,
    tok TEXT,
    estimated_gas NUMERIC DEFAULT 0,
    estimated_duration INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'SKIPPED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. RISK ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    balance_check TEXT NOT NULL DEFAULT 'PASS' CHECK (balance_check IN ('PASS', 'WARN', 'FAIL')),
    recipient_check TEXT NOT NULL DEFAULT 'PASS' CHECK (recipient_check IN ('PASS', 'WARN', 'FAIL')),
    slippage_check TEXT NOT NULL DEFAULT 'PASS' CHECK (slippage_check IN ('PASS', 'WARN', 'FAIL')),
    network_check TEXT NOT NULL DEFAULT 'PASS' CHECK (network_check IN ('PASS', 'WARN', 'FAIL')),
    contract_check TEXT NOT NULL DEFAULT 'PASS' CHECK (contract_check IN ('PASS', 'WARN', 'FAIL')),
    overall_risk TEXT NOT NULL DEFAULT 'LOW' CHECK (overall_risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    warnings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. APPROVALS
CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TXNS
CREATE TABLE IF NOT EXISTS public.txns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
    hash TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    chain_id NUMERIC NOT NULL,
    gas_used NUMERIC DEFAULT 0,
    gas_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    explorer_url TEXT
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_business_profiles_owner ON public.business_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_business ON public.wallets(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_business ON public.payment_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_intents_payment_request ON public.intents(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_payment_request ON public.payment_plans(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_route_options_payment_plan ON public.route_options(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_steps_payment_plan ON public.payment_steps(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_payment_plan ON public.risk_assessments(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_approvals_payment_request ON public.approvals(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_txns_payment_request ON public.txns(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_txns_hash ON public.txns(hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON public.audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_payment_request ON public.audit_logs(payment_request_id);

-- =============================================================================
-- 3. TRIGGERS & FUNCTIONS
-- =============================================================================

-- Auto update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_business_profiles ON public.business_profiles;
CREATE TRIGGER set_updated_at_business_profiles
    BEFORE UPDATE ON public.business_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_wallets ON public.wallets;
CREATE TRIGGER set_updated_at_wallets
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_payment_requests ON public.payment_requests;
CREATE TRIGGER set_updated_at_payment_requests
    BEFORE UPDATE ON public.payment_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, wallet_address, display_name, created_at, updated_at)
    VALUES (
        new.id,
        new.raw_user_meta_data->>'wallet_address',
        COALESCE(new.raw_user_meta_data->>'display_name', new.email),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        wallet_address = EXCLUDED.wallet_address,
        display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
        updated_at = NOW();
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper Security Definer Functions for Row Level Security (RLS)
CREATE OR REPLACE FUNCTION public.is_business_owner(b_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.business_profiles
        WHERE id = b_id AND owner_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_payment_request_owner(pr_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.payment_requests pr
        JOIN public.business_profiles bp ON pr.business_id = bp.id
        WHERE pr.id = pr_id AND bp.owner_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_payment_plan_owner(pp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.payment_plans pp
        JOIN public.payment_requests pr ON pp.payment_request_id = pr.id
        JOIN public.business_profiles bp ON pr.business_id = bp.id
        WHERE pp.id = pp_id AND bp.owner_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. USERS POLICIES
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.users;
CREATE POLICY "Users insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. BUSINESS PROFILES POLICIES
DROP POLICY IF EXISTS "Owner view own business" ON public.business_profiles;
CREATE POLICY "Owner view own business" ON public.business_profiles FOR SELECT USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owner insert business" ON public.business_profiles;
CREATE POLICY "Owner insert business" ON public.business_profiles FOR INSERT WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owner update business" ON public.business_profiles;
CREATE POLICY "Owner update business" ON public.business_profiles FOR UPDATE USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owner delete business" ON public.business_profiles;
CREATE POLICY "Owner delete business" ON public.business_profiles FOR DELETE USING (owner_user_id = auth.uid());

-- 3. WALLETS POLICIES
DROP POLICY IF EXISTS "Business owner view wallets" ON public.wallets;
CREATE POLICY "Business owner view wallets" ON public.wallets FOR SELECT USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "Business owner manage wallets" ON public.wallets;
CREATE POLICY "Business owner manage wallets" ON public.wallets FOR ALL USING (public.is_business_owner(business_id));

-- 4. PAYMENT REQUESTS POLICIES
DROP POLICY IF EXISTS "Business owner view payment requests" ON public.payment_requests;
CREATE POLICY "Business owner view payment requests" ON public.payment_requests FOR SELECT USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "Business owner manage payment requests" ON public.payment_requests;
CREATE POLICY "Business owner manage payment requests" ON public.payment_requests FOR ALL USING (public.is_business_owner(business_id));

-- 5. INTENTS POLICIES
DROP POLICY IF EXISTS "Business owner view intents" ON public.intents;
CREATE POLICY "Business owner view intents" ON public.intents FOR SELECT USING (public.is_payment_request_owner(payment_request_id));

DROP POLICY IF EXISTS "Business owner manage intents" ON public.intents;
CREATE POLICY "Business owner manage intents" ON public.intents FOR ALL USING (public.is_payment_request_owner(payment_request_id));

-- 6. PAYMENT PLANS POLICIES
DROP POLICY IF EXISTS "Business owner view payment plans" ON public.payment_plans;
CREATE POLICY "Business owner view payment plans" ON public.payment_plans FOR SELECT USING (public.is_payment_request_owner(payment_request_id));

DROP POLICY IF EXISTS "Business owner manage payment plans" ON public.payment_plans;
CREATE POLICY "Business owner manage payment plans" ON public.payment_plans FOR ALL USING (public.is_payment_request_owner(payment_request_id));

-- 7. ROUTE OPTIONS POLICIES
DROP POLICY IF EXISTS "Business owner view route options" ON public.route_options;
CREATE POLICY "Business owner view route options" ON public.route_options FOR SELECT USING (public.is_payment_plan_owner(payment_plan_id));

DROP POLICY IF EXISTS "Business owner manage route options" ON public.route_options;
CREATE POLICY "Business owner manage route options" ON public.route_options FOR ALL USING (public.is_payment_plan_owner(payment_plan_id));

-- 8. PAYMENT STEPS POLICIES
DROP POLICY IF EXISTS "Business owner view payment steps" ON public.payment_steps;
CREATE POLICY "Business owner view payment steps" ON public.payment_steps FOR SELECT USING (public.is_payment_plan_owner(payment_plan_id));

DROP POLICY IF EXISTS "Business owner manage payment steps" ON public.payment_steps;
CREATE POLICY "Business owner manage payment steps" ON public.payment_steps FOR ALL USING (public.is_payment_plan_owner(payment_plan_id));

-- 9. RISK ASSESSMENTS POLICIES
DROP POLICY IF EXISTS "Business owner view risk assessments" ON public.risk_assessments;
CREATE POLICY "Business owner view risk assessments" ON public.risk_assessments FOR SELECT USING (public.is_payment_plan_owner(payment_plan_id));

DROP POLICY IF EXISTS "Business owner manage risk assessments" ON public.risk_assessments;
CREATE POLICY "Business owner manage risk assessments" ON public.risk_assessments FOR ALL USING (public.is_payment_plan_owner(payment_plan_id));

-- 10. APPROVALS POLICIES
DROP POLICY IF EXISTS "Business owner view approvals" ON public.approvals;
CREATE POLICY "Business owner view approvals" ON public.approvals FOR SELECT USING (public.is_payment_request_owner(payment_request_id));

DROP POLICY IF EXISTS "Business owner manage approvals" ON public.approvals;
CREATE POLICY "Business owner manage approvals" ON public.approvals FOR ALL USING (public.is_payment_request_owner(payment_request_id));

-- 11. TXNS POLICIES
DROP POLICY IF EXISTS "Business owner view txns" ON public.txns;
CREATE POLICY "Business owner view txns" ON public.txns FOR SELECT USING (
    payment_request_id IS NULL OR public.is_payment_request_owner(payment_request_id)
);

DROP POLICY IF EXISTS "Business owner manage txns" ON public.txns;
CREATE POLICY "Business owner manage txns" ON public.txns FOR ALL USING (
    payment_request_id IS NULL OR public.is_payment_request_owner(payment_request_id)
);

-- 12. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Business owner view audit logs" ON public.audit_logs;
CREATE POLICY "Business owner view audit logs" ON public.audit_logs FOR SELECT USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "Business owner insert audit logs" ON public.audit_logs;
CREATE POLICY "Business owner insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.is_business_owner(business_id));
