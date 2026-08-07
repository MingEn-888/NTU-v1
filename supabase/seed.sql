-- Seed Data: supabase/seed.sql
-- Purpose: Pre-populates mock user, wallets, conversation logs, AI parsed intents, and transaction history for demo purposes

-- 1. DEMO USER IN AUTH & PUBLIC USERS
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
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice@intentrouter.demo',
    '$2a$10$wT.qXqJ5D3V8q8jVz7J7e.8v6Q1H5O9z2W3e4R5t6Y7u8I9o0P1Q2', -- dummy hashed pwd
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "ens": "alice.eth"}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, address, created_at)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    NOW() - INTERVAL '7 days'
) ON CONFLICT (id) DO UPDATE SET address = EXCLUDED.address;

-- 2. DEMO WALLETS
INSERT INTO public.wallets (id, user_id, address, ens, chain_id, balance, updated_at)
VALUES
    (
        'w0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        'alice.eth',
        11155111, -- Ethereum Sepolia
        2.450000,
        NOW()
    ),
    (
        'w0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000001',
        '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        'alice.eth',
        421614, -- Arbitrum Sepolia
        15.800000,
        NOW()
    ),
    (
        'w0000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000001',
        '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        'alice.eth',
        84532, -- Base Sepolia
        1200.500000,
        NOW()
    );

-- 3. DEMO CONVERSATION 1: Cross-Chain Transfer
INSERT INTO public.conversations (id, user_id, created_at)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '2 days'
);

INSERT INTO public.messages (id, conversation_id, role, content, created_at)
VALUES
    (
        'm0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        'USER',
        'Send 0.5 ETH to bob.eth on Arbitrum when gas fee is lowest.',
        NOW() - INTERVAL '2 days'
    ),
    (
        'm0000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000001',
        'ASSISTANT',
        'I parsed your intent: Transfer 0.5 ETH to bob.eth (0x70997970C51812dc3A010C7d01b50e0d17dc79C8) on Arbitrum Sepolia. The optimal path saves 42% gas fees via Arbitrum Native Bridge.',
        NOW() - INTERVAL '2 days' + INTERVAL '5 seconds'
    );

INSERT INTO public.intents (id, message_id, action, recipient, amount, currency, target_chain, schedule, confidence, created_at)
VALUES (
    'i0000000-0000-0000-0000-000000000001',
    'm0000000-0000-0000-0000-000000000001',
    'TRANSFER',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    0.500000,
    'ETH',
    'Arbitrum Sepolia (421614)',
    'IMMEDIATE',
    0.98,
    NOW() - INTERVAL '2 days'
);

-- 4. DEMO CONVERSATION 2: Scheduled Swap Intent
INSERT INTO public.conversations (id, user_id, created_at)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '12 hours'
);

INSERT INTO public.messages (id, conversation_id, role, content, created_at)
VALUES
    (
        'm0000000-0000-0000-0000-000000000003',
        'c0000000-0000-0000-0000-000000000002',
        'USER',
        'Swap 500 USDC to ETH on Base tomorrow at 09:00 UTC.',
        NOW() - INTERVAL '12 hours'
    ),
    (
        'm0000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000002',
        'ASSISTANT',
        'Scheduled intent registered: Swap 500 USDC to ETH on Base Sepolia at 09:00 UTC. Router will execute via Uniswap V3 pool.',
        NOW() - INTERVAL '12 hours' + INTERVAL '3 seconds'
    );

INSERT INTO public.intents (id, message_id, action, recipient, amount, currency, target_chain, schedule, confidence, created_at)
VALUES (
    'i0000000-0000-0000-0000-000000000002',
    'm0000000-0000-0000-0000-000000000003',
    'SWAP',
    '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    500.000000,
    'USDC',
    'Base Sepolia (84532)',
    '2026-08-09T09:00:00Z',
    0.95,
    NOW() - INTERVAL '12 hours'
);

-- 5. DEMO TRANSACTIONS HISTORY
INSERT INTO public.transactions (id, user_id, hash, status, chain_id, gas_saved, created_at, explorer_url)
VALUES
    (
        't0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        '0x8f23a519b42e71d3a58c142e09b119642a84b0e5124976c5b4d7e193561a782b',
        'CONFIRMED',
        421614, -- Arbitrum Sepolia
        0.004250,
        NOW() - INTERVAL '2 days',
        'https://sepolia.arbiscan.io/tx/0x8f23a519b42e71d3a58c142e09b119642a84b0e5124976c5b4d7e193561a782b'
    ),
    (
        't0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000001',
        '0x3c71a92e105f8842bc194a20b08a931ef194519bc1607f23a4901b490d18f52a',
        'PENDING',
        84532, -- Base Sepolia
        0.001820,
        NOW() - INTERVAL '30 minutes',
        'https://sepolia.basescan.org/tx/0x3c71a92e105f8842bc194a20b08a931ef194519bc1607f23a4901b490d18f52a'
    ),
    (
        't0000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000001',
        '0x1a9982f45c381b10a293b4820a1748a02c91823f54812398d103f194721c491e',
        'FAILED',
        11155111, -- Ethereum Sepolia
        0.000000,
        NOW() - INTERVAL '5 days',
        'https://sepolia.etherscan.io/tx/0x1a9982f45c381b10a293b4820a1748a02c91823f54812398d103f194721c491e'
    );
