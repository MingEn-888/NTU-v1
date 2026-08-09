-- Migration: 20260809000000_ai_payment_operations.sql
-- Description: Phase 4 IBAP AI Payment Operations — conversation persistence layer.
-- Stores the natural-language <-> payment-operation conversation between the
-- finance operator and the IBAP agent, including the parsed intent, generated
-- payment plan, and persisted entity ids for the payment lifecycle records.

-- 1. CONVERSATION MESSAGES
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
    content TEXT NOT NULL,
    -- Serialized ParsedPaymentIntent JSONB (null for plain messages)
    intent JSONB,
    -- Serialized PaymentPlan JSONB (null until a plan is generated)
    plan JSONB,
    -- Payment lifecycle entity ids { paymentRequestId, intentId, planId, routeIds }
    entity_ids JSONB,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('STREAMING', 'COMPLETED', 'ERROR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_conversation_messages_business ON public.conversation_messages(business_id, created_at);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business owner view conversation" ON public.conversation_messages;
CREATE POLICY "Business owner view conversation" ON public.conversation_messages
    FOR SELECT USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "Business owner manage conversation" ON public.conversation_messages;
CREATE POLICY "Business owner manage conversation" ON public.conversation_messages
    FOR ALL USING (public.is_business_owner(business_id));
