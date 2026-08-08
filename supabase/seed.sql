-- Seed Data: supabase/seed.sql
-- Purpose: Realistic business payment lifecycle demonstration for IBAP Payment Operations
-- Scenario: "Pay Alice RM2,500 for invoice INV-1024 by Friday."

-- 1. AUTH USER & PUBLIC USER (Business Finance Manager)
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    'b1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'finance@techcorp.io',
    '$2a$10$wT.qXqJ5D3V8q8jVz7J7e.8v6Q1H5O9z2W3e4R5t6Y7u8I9o0P1Q2',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"display_name": "Sarah Connor (CFO)", "wallet_address": "0x3C44CdD470368a0623A22D2C4022878D3f9905E5"}',
    NOW() - INTERVAL '30 days',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, wallet_address, display_name, created_at, updated_at)
VALUES (
    'b1000000-0000-0000-0000-000000000001',
    '0x3C44CdD470368a0623A22D2C4022878D3f9905E5',
    'Sarah Connor (CFO)',
    NOW() - INTERVAL '30 days',
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    wallet_address = EXCLUDED.wallet_address,
    display_name = EXCLUDED.display_name;

-- 2. BUSINESS PROFILE
INSERT INTO public.business_profiles (id, owner_user_id, business_name, default_chain, created_at, updated_at)
VALUES (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'TechCorp Solutions Sdn Bhd',
    'polygon',
    NOW() - INTERVAL '30 days',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. TREASURY WALLET
INSERT INTO public.wallets (id, business_id, address, ens, chain_id, native_balance, updated_at)
VALUES (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    '0x3C44CdD470368a0623A22D2C4022878D3f9905E5',
    'techcorp-treasury.eth',
    137, -- Polygon Mainnet
    1250.500000,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. PAYMENT REQUEST
-- Prompt scenario: "Pay Alice RM2,500 for invoice INV-1024 by Friday."
INSERT INTO public.payment_requests (
    id,
    business_id,
    created_by,
    description,
    recipient_name,
    recipient_address,
    amount,
    currency,
    requested_currency,
    due_date,
    status,
    source,
    created_at,
    updated_at
) VALUES (
    'b4000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'Invoice INV-1024 - Vendor Payout to Alice Tan',
    'Alice Tan (Software Vendor)',
    '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    2500.00,
    'MYR',
    'USDC',
    NOW() + INTERVAL '4 days',
    'COMPLETED',
    'CHAT',
    NOW() - INTERVAL '2 hours',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 5. AI PARSED INTENT
INSERT INTO public.intents (
    id,
    payment_request_id,
    action,
    recipient,
    amount,
    currency,
    target_chain,
    due_date,
    confidence,
    missing_information,
    raw_input,
    created_at
) VALUES (
    'b5000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'PAY_VENDOR',
    '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    2500.00,
    'MYR',
    'polygon',
    NOW() + INTERVAL '4 days',
    0.98,
    '[]'::jsonb,
    'Pay Alice RM2,500 for invoice INV-1024 by Friday.',
    NOW() - INTERVAL '1 hour 58 minutes'
) ON CONFLICT (id) DO NOTHING;

-- 6. ROUTE OPTIONS (Populated first to satisfy deferrable FK in payment_plans)
INSERT INTO public.route_options (
    id,
    payment_plan_id,
    route_name,
    chain,
    estimated_gas,
    estimated_time,
    transaction_count,
    risk_score,
    total_score,
    savings,
    is_recommended,
    created_at
) VALUES 
(
    'b7000000-0000-0000-0000-000000000001',
    'b6000000-0000-0000-0000-000000000001',
    'Polygon Native USDC Direct Transfer',
    'polygon',
    0.045000,
    15,
    1,
    5.0,
    95.0,
    12.50,
    TRUE,
    NOW() - INTERVAL '1 hour 55 minutes'
),
(
    'b7000000-0000-0000-0000-000000000002',
    'b6000000-0000-0000-0000-000000000001',
    'Ethereum Mainnet Bridge & Pay',
    'ethereum',
    4.800000,
    180,
    2,
    18.0,
    72.0,
    0.00,
    FALSE,
    NOW() - INTERVAL '1 hour 55 minutes'
) ON CONFLICT (id) DO NOTHING;

-- 7. PAYMENT PLAN
INSERT INTO public.payment_plans (
    id,
    payment_request_id,
    selected_route_id,
    total_estimated_gas,
    estimated_duration,
    savings,
    explanation,
    risk_score,
    created_at
) VALUES (
    'b6000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'b7000000-0000-0000-0000-000000000001',
    0.045000,
    15,
    12.50,
    'Direct Polygon native USDC payment selected. Converts MYR 2,500 to 568.18 USDC. Minimal gas fee ($0.045) and instant settlement (15 seconds).',
    5.0,
    NOW() - INTERVAL '1 hour 55 minutes'
) ON CONFLICT (id) DO NOTHING;

-- 8. PAYMENT STEPS
INSERT INTO public.payment_steps (
    id,
    payment_plan_id,
    step_order,
    action_type,
    title,
    description,
    source_chain,
    destination_chain,
    tok,
    estimated_gas,
    estimated_duration,
    status,
    created_at
) VALUES 
(
    'b8000000-0000-0000-0000-000000000001',
    'b6000000-0000-0000-0000-000000000001',
    1,
    'CHECK_ALLOWANCE',
    'Verify USDC Allowance',
    'Verify corporate treasury vault allowance for payment router smart contract',
    'polygon',
    'polygon',
    'USDC',
    0.005000,
    5,
    'COMPLETED',
    NOW() - INTERVAL '1 hour 50 minutes'
),
(
    'b8000000-0000-0000-0000-000000000002',
    'b6000000-0000-0000-0000-000000000001',
    2,
    'EXECUTE_PAYMENT',
    'Transfer USDC to Recipient',
    'Transfer 568.18 USDC to Alice (0x71C7656EC7ab88b098defB751B7401B5f6d8976F)',
    'polygon',
    'polygon',
    'USDC',
    0.040000,
    10,
    'COMPLETED',
    NOW() - INTERVAL '1 hour 45 minutes'
) ON CONFLICT (id) DO NOTHING;

-- 9. RISK ASSESSMENT
INSERT INTO public.risk_assessments (
    id,
    payment_plan_id,
    balance_check,
    recipient_check,
    slippage_check,
    network_check,
    contract_check,
    overall_risk,
    warnings,
    created_at
) VALUES (
    'b9000000-0000-0000-0000-000000000001',
    'b6000000-0000-0000-0000-000000000001',
    'PASS',
    'PASS',
    'PASS',
    'PASS',
    'PASS',
    'LOW',
    '[{"code": "SLIPPAGE_OK", "message": "Slippage within 0.1% tolerance"}, {"code": "RECIPIENT_VERIFIED", "message": "Recipient address matches vendor record for Alice"}]'::jsonb,
    NOW() - INTERVAL '1 hour 52 minutes'
) ON CONFLICT (id) DO NOTHING;

-- 10. APPROVAL
INSERT INTO public.approvals (
    id,
    payment_request_id,
    approved_by,
    status,
    approved_at,
    rejection_reason,
    created_at
) VALUES (
    'ba000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'APPROVED',
    NOW() - INTERVAL '1 hour 30 minutes',
    NULL,
    NOW() - INTERVAL '1 hour 40 minutes'
) ON CONFLICT (id) DO NOTHING;

-- 11. CONFIRMED TRANSACTION
INSERT INTO public.txns (
    id,
    payment_request_id,
    payment_plan_id,
    hash,
    status,
    chain_id,
    gas_used,
    gas_cost,
    created_at,
    confirmed_at,
    explorer_url
) VALUES (
    'bb000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'b6000000-0000-0000-0000-000000000001',
    '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
    'CONFIRMED',
    137, -- Polygon Mainnet
    65420,
    0.042500,
    NOW() - INTERVAL '1 hour 15 minutes',
    NOW() - INTERVAL '1 hour 14 minutes',
    'https://polygonscan.com/tx/0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b'
) ON CONFLICT (id) DO NOTHING;

-- 12. AUDIT LOGS
INSERT INTO public.audit_logs (
    id,
    business_id,
    user_id,
    payment_request_id,
    event_type,
    description,
    meta,
    created_at
) VALUES 
(
    'bc000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'PAYMENT_REQUEST_CREATED',
    'Payment request created via AI agent chat interface for invoice INV-1024',
    '{"source": "CHAT", "amount": 2500, "currency": "MYR", "recipient_name": "Alice Tan"}'::jsonb,
    NOW() - INTERVAL '2 hours'
),
(
    'bc000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'INTENT_PARSED',
    'AI intent engine extracted action PAY_VENDOR with 98% confidence',
    '{"intent_id": "b5000000-0000-0000-0000-000000000001", "confidence": 0.98}'::jsonb,
    NOW() - INTERVAL '1 hour 58 minutes'
),
(
    'bc000000-0000-0000-0000-000000000003',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'PAYMENT_PLAN_GENERATED',
    'Route optimizer generated 2 candidate routes; Polygon native route selected',
    '{"recommended_route": "Polygon Native USDC Direct Transfer", "estimated_gas": 0.045}'::jsonb,
    NOW() - INTERVAL '1 hour 55 minutes'
),
(
    'bc000000-0000-0000-0000-000000000004',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'RISK_ASSESSMENT_COMPLETED',
    'Risk engine verified balance, recipient, slippage, and contracts. Overall risk: LOW',
    '{"overall_risk": "LOW", "balance_check": "PASS", "recipient_check": "PASS"}'::jsonb,
    NOW() - INTERVAL '1 hour 52 minutes'
),
(
    'bc000000-0000-0000-0000-000000000005',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'PAYMENT_APPROVED',
    'Payment request approved by Sarah Connor (CFO)',
    '{"approved_by": "Sarah Connor (CFO)", "approved_at": "2026-08-08T10:15:00Z"}'::jsonb,
    NOW() - INTERVAL '1 hour 30 minutes'
),
(
    'bc000000-0000-0000-0000-000000000006',
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    'PAYMENT_EXECUTED',
    'On-chain transaction confirmed on Polygon Mainnet (65,420 gas used)',
    '{"tx_hash": "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b", "chain_id": 137}'::jsonb,
    NOW() - INTERVAL '1 hour 14 minutes'
) ON CONFLICT (id) DO NOTHING;
