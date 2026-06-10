-- =============================================================================
-- AGREEMENT MIGRATION: Express/MySQL → Supabase PostgreSQL
-- =============================================================================
-- Tables: agreements
-- Status: Draft agreements with Supabase UUID auth
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREATE AGREEMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agreements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'template'::text CHECK (status IN ('template', 'draft', 'signed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enforce pair uniqueness via UNIQUE INDEX (lexicographic ordering)
CREATE UNIQUE INDEX idx_agreements_unique_pair ON public.agreements(
    LEAST(user_a_id, user_b_id),
    GREATEST(user_a_id, user_b_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_agreements_user_a ON public.agreements(user_a_id);
CREATE INDEX idx_agreements_user_b ON public.agreements(user_b_id);
CREATE INDEX idx_agreements_updated_at ON public.agreements(updated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view agreements they are part of
CREATE POLICY "Users can view their agreements"
ON public.agreements
FOR SELECT
USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
);

-- Policy: Users can create agreements with another user
CREATE POLICY "Users can create agreements"
ON public.agreements
FOR INSERT
WITH CHECK (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
);

-- Policy: Users can update their agreements
CREATE POLICY "Users can update their agreements"
ON public.agreements
FOR UPDATE
USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
)
WITH CHECK (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
);

-- Policy: Users can delete their agreements
CREATE POLICY "Users can delete their agreements"
ON public.agreements
FOR DELETE
USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC: GET_AGREEMENT (Load or generate template)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_agreement(
    p_user_a_id UUID,
    p_user_b_id UUID
)
RETURNS TABLE (
    id UUID,
    user_a_id UUID,
    user_b_id UUID,
    content TEXT,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_agreement_id UUID;
    v_content TEXT;
    v_user_a_name TEXT;
    v_user_b_name TEXT;
    v_user_a_budget INT;
    v_user_b_budget INT;
    v_user_a_deposit INT;
    v_user_b_deposit INT;
    v_user_a_cleanliness INT;
    v_user_a_noise_tolerance VARCHAR;
BEGIN
    -- Check if agreement exists
    SELECT id INTO v_agreement_id
    FROM public.agreements
    WHERE (user_a_id = p_user_a_id AND user_b_id = p_user_b_id)
       OR (user_a_id = p_user_b_id AND user_b_id = p_user_a_id)
    LIMIT 1;
    
    IF v_agreement_id IS NOT NULL THEN
        RETURN QUERY SELECT * FROM public.agreements WHERE id = v_agreement_id;
        RETURN;
    END IF;
    
    -- Generate template from profiles and auth.users
    SELECT 
        u_a.raw_user_meta_data->>'name', u_b.raw_user_meta_data->>'name',
        pr_a.budget, pr_b.budget,
        pr_a.deposit, pr_b.deposit,
        pr_a.cleanliness, pr_a.noise_tolerance
    INTO 
        v_user_a_name, v_user_b_name,
        v_user_a_budget, v_user_b_budget,
        v_user_a_deposit, v_user_b_deposit,
        v_user_a_cleanliness, v_user_a_noise_tolerance
    FROM public.profiles pr_a
    JOIN public.profiles pr_b ON pr_b.user_id = p_user_b_id
    JOIN auth.users u_a ON u_a.id = pr_a.user_id
    JOIN auth.users u_b ON u_b.id = pr_b.user_id
    WHERE pr_a.user_id = p_user_a_id;
    
    -- Fallback names if profiles missing
    v_user_a_name := COALESCE(v_user_a_name, 'User A');
    v_user_b_name := COALESCE(v_user_b_name, 'User B');
    v_user_a_budget := COALESCE(v_user_a_budget, 15000);
    v_user_b_budget := COALESCE(v_user_b_budget, 15000);
    v_user_a_deposit := COALESCE(v_user_a_deposit, 5000);
    v_user_b_deposit := COALESCE(v_user_b_deposit, 5000);
    v_user_a_cleanliness := COALESCE(v_user_a_cleanliness, 3);
    v_user_a_noise_tolerance := COALESCE(v_user_a_noise_tolerance, 'moderate');
    
    -- Build template
    v_content := 'ROOMMATE AGREEMENT

This agreement is entered into by ' || v_user_a_name || ' and ' || v_user_b_name || '.

1. RENT & DEPOSIT
- Total Rent: ₹' || (v_user_a_budget + v_user_b_budget)::TEXT || ' (Split: ' || v_user_a_name || ' ₹' || v_user_a_budget::TEXT || ', ' || v_user_b_name || ' ₹' || v_user_b_budget::TEXT || ')
- Security Deposit: ₹' || (v_user_a_deposit + v_user_b_deposit)::TEXT || '

2. CLEANING SCHEDULE
- Shared spaces (Kitchen, Hall) to be cleaned weekly.
- Cleanliness Priority: ' || (CASE WHEN v_user_a_cleanliness >= 4 THEN 'High' ELSE 'Moderate' END) || '

3. QUIET HOURS
- Quiet hours established from 10 PM to 7 AM.
- Noise Tolerance: ' || v_user_a_noise_tolerance || '

4. GUEST POLICY
- Guests allowed with 24h prior notice.
- Overnight guests limited to 2 nights per week.

SIGNED:
____________________ (' || v_user_a_name || ')
____________________ (' || v_user_b_name || ')
';
    
    -- Return template as transient record
    RETURN QUERY SELECT 
        gen_random_uuid()::UUID,
        p_user_a_id,
        p_user_b_id,
        v_content::TEXT,
        'template'::VARCHAR,
        NOW()::TIMESTAMP WITH TIME ZONE,
        NOW()::TIMESTAMP WITH TIME ZONE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPC: SAVE_AGREEMENT (Upsert agreement)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_agreement(
    p_user_a_id UUID,
    p_user_b_id UUID,
    p_content TEXT,
    p_status VARCHAR DEFAULT 'draft'
)
RETURNS TABLE (
    id UUID,
    user_a_id UUID,
    user_b_id UUID,
    content TEXT,
    status VARCHAR,
    message TEXT
) AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Validate user is one of the two
    IF (auth.uid() != p_user_a_id AND auth.uid() != p_user_b_id) THEN
        RAISE EXCEPTION 'Unauthorized: user must be one of the agreement parties';
    END IF;
    
    -- Upsert: insert or update
    INSERT INTO public.agreements (user_a_id, user_b_id, content, status, updated_at)
    VALUES (p_user_a_id, p_user_b_id, p_content, p_status, NOW())
    ON CONFLICT (
        LEAST(user_a_id, user_b_id),
        GREATEST(user_a_id, user_b_id)
    )
    DO UPDATE SET 
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING agreements.id INTO v_id;
    
    RETURN QUERY SELECT 
        v_id,
        p_user_a_id,
        p_user_b_id,
        p_content,
        p_status::VARCHAR,
        'Agreement saved successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. TRIGGER: Update updated_at on modifications
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agreements_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agreements_timestamp_trigger
BEFORE UPDATE ON public.agreements
FOR EACH ROW
EXECUTE FUNCTION public.agreements_update_timestamp();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. MIGRATION DATA (If migrating from legacy system)
-- ─────────────────────────────────────────────────────────────────────────
-- NOTE: This section requires mapping old INT user IDs to UUID auth users
-- Uncomment and modify as needed:
--
-- INSERT INTO public.agreements (user_a_id, user_b_id, content, status, created_at, updated_at)
-- SELECT 
--     (SELECT auth.uid() FROM auth.users LIMIT 1) AS user_a_id,
--     (SELECT auth.uid() FROM auth.users LIMIT 1) AS user_b_id,
--     content,
--     status,
--     created_at,
--     updated_at
-- FROM legacy_agreements_backup
-- WHERE user_a_id NOT IN (SELECT legacy_user_id FROM user_id_map)
-- ON CONFLICT DO NOTHING;
--
-- ─────────────────────────────────────────────────────────────────────────

