-- Migration: 20260823000000_conversation_history.sql
-- Description: Conversation history — group conversation_messages into browsable
-- threads so the assistant starts fresh on each visit and the operator can open
-- a past conversation from the History panel instead of always auto-restoring.

-- 1. Add the thread grouping column (null for legacy rows until backfilled).
ALTER TABLE public.conversation_messages
    ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- 2. Index for fast per-thread fetch + history listing.
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
    ON public.conversation_messages(business_id, conversation_id, created_at);

-- 3. Backfill legacy rows: each business's existing flat stream becomes ONE
--    conversation so no history is orphaned by the new grouping.
DO $$
DECLARE
    b RECORD;
    cid UUID;
BEGIN
    FOR b IN
        SELECT DISTINCT business_id
        FROM public.conversation_messages
        WHERE conversation_id IS NULL
    LOOP
        cid := gen_random_uuid();
        UPDATE public.conversation_messages
        SET conversation_id = cid
        WHERE business_id = b.business_id AND conversation_id IS NULL;
    END LOOP;
END $$;
