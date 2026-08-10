# Database Testing & Verification Guide — Phase 2

This document provides step-by-step instructions and SQL verification scripts to validate the PayMaster Phase 2 database migration, RLS policies, constraints, and seed data.

---

## 1. Migration & Seeding Setup

### Option A: Local Supabase CLI (Recommended)
1. Start local Supabase containers:
   ```bash
   npx supabase start
   ```
2. Reset the database to apply migrations and seed data automatically:
   ```bash
   npx supabase db reset
   ```

### Option B: Supabase Dashboard / Cloud Project
1. Navigate to the **SQL Editor** in your Supabase Dashboard.
2. Execute the contents of `supabase/migrations/20260201000000_ibap_schema.sql`.
3. Execute the contents of `supabase/seed.sql`.

---

## 2. Verification SQL Scripts

Run the following test queries in your SQL Editor or via `psql` to verify table relationships and data integrity.

### Test 1: Verify End-to-End Payment Lifecycle Query
Verify that a single query can traverse the entire 8-stage pipeline from **Payment Request** down to **Transactions** and **Audit Logs** for invoice `INV-1024`:

```sql
SELECT 
    pr.id AS payment_request_id,
    bp.business_name,
    pr.recipient_name,
    pr.amount || ' ' || pr.currency AS requested_amount,
    i.action AS ai_action,
    i.confidence AS ai_confidence,
    ro.route_name AS selected_route,
    pp.risk_score,
    ra.overall_risk,
    a.status AS approval_status,
    t.hash AS tx_hash,
    t.status AS tx_status,
    COUNT(al.id) AS audit_log_count
FROM public.payment_requests pr
JOIN public.business_profiles bp ON pr.business_id = bp.id
JOIN public.intents i ON i.payment_request_id = pr.id
JOIN public.payment_plans pp ON pp.payment_request_id = pr.id
JOIN public.route_options ro ON pp.selected_route_id = ro.id
JOIN public.risk_assessments ra ON ra.payment_plan_id = pp.id
JOIN public.approvals a ON a.payment_request_id = pr.id
LEFT JOIN public.txns t ON t.payment_request_id = pr.id
LEFT JOIN public.audit_logs al ON al.payment_request_id = pr.id
WHERE pr.description LIKE '%INV-1024%'
GROUP BY pr.id, bp.business_name, pr.recipient_name, pr.amount, pr.currency, 
         i.action, i.confidence, ro.route_name, pp.risk_score, ra.overall_risk, a.status, t.hash, t.status;
```

**Expected Result**:
- Returns 1 row showing business `"TechCorp Solutions Sdn Bhd"`, requested amount `"2500.00 MYR"`, AI Action `"PAY_VENDOR"`, route `"Polygon Native USDC Direct Transfer"`, overall risk `"LOW"`, approval status `"APPROVED"`, tx status `"CONFIRMED"`, and 6 audit logs.

---

### Test 2: Row Level Security (RLS) Isolation Verification

Test that queries executed as user `b1000000-0000-0000-0000-000000000001` (TechCorp CFO) can access TechCorp records, but queries as an unauthenticated or unauthorized user return 0 rows.

```sql
-- Step A: Set session auth context to TechCorp CFO
SET LOCAL request.jwt.claims = '{"sub": "b1000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Query payment requests
SELECT id, recipient_name, amount, status FROM public.payment_requests;
-- Expected: Returns 1 payment request record.

-- Query audit logs
SELECT id, event_type, description FROM public.audit_logs;
-- Expected: Returns 6 audit log records.

-- Step B: Switch session auth context to an unauthorized user
SET LOCAL request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';

-- Query payment requests again
SELECT id, recipient_name, amount, status FROM public.payment_requests;
-- Expected: Returns 0 rows (RLS blocks access).

-- Query audit logs again
SELECT id, event_type, description FROM public.audit_logs;
-- Expected: Returns 0 rows (RLS blocks access).
```

---

### Test 3: Constraint Verification

#### A. Negative Amount Check
```sql
INSERT INTO public.payment_requests (
    business_id, recipient_name, recipient_address, amount, currency
) VALUES (
    'b2000000-0000-0000-0000-000000000001', 'Bad Recipient', '0x123', -500.00, 'USDC'
);
```
**Expected Result**: Fails with `check constraint "payment_requests_amount_check"`.

#### B. Invalid Status Enum Check
```sql
INSERT INTO public.payment_requests (
    business_id, recipient_name, recipient_address, amount, currency, status
) VALUES (
    'b2000000-0000-0000-0000-000000000001', 'Test Recipient', '0x123', 100.00, 'USDC', 'INVALID_STATUS'
);
```
**Expected Result**: Fails with `check constraint "payment_requests_status_check"`.

---

## 3. Verification Checklist

- [x] All 12 tables created with UUID primary keys.
- [x] Foreign key constraints configured with appropriate `ON DELETE CASCADE` or `ON DELETE SET NULL`.
- [x] Deferrable foreign key between `payment_plans` and `route_options` works cleanly.
- [x] Triggers auto-update `updated_at` timestamps on row updates.
- [x] `auth.users` trigger automatically syncs to `public.users`.
- [x] RLS enabled on all 12 tables.
- [x] Seed data populates complete demo flow for invoice `INV-1024`.
