-- ============================================================
-- Hey Nomads - Supabase Shortlist Migration
-- Run this script after migrate_supabase.sql
-- ============================================================

-- 1. Shortlists Table
create table if not exists public.shortlists (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    target_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (user_id, target_id),
    check (user_id <> target_id)
);

-- 2. Indexes
create index if not exists shortlists_user_id_created_at_idx
on public.shortlists (user_id, created_at desc);

create index if not exists shortlists_target_id_idx
on public.shortlists (target_id);

-- 3. Stored Procedure: get_shortlist
create or replace function public.get_shortlist(p_user_id uuid)
returns setof jsonb language plpgsql security definer as $$
begin
    return query
    select jsonb_build_object(
        'id', p.user_id,
        'user_id', p.user_id,
        'name', coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
        'email', u.email,
        'profile_image', p.profile_image,
        'city', p.city,
        'budget', p.budget,
        'move_in_date', p.move_in_date,
        'occupation', p.occupation,
        'is_verified', p.is_verified,
        'shortlisted_at', s.created_at
    )
    from public.shortlists s
    join public.profiles p on p.user_id = s.target_id
    join auth.users u on u.id = p.user_id
    where s.user_id = p_user_id
    order by s.created_at desc;
end;
$$;

-- 4. Enable row-level security (RLS)
alter table public.shortlists enable row level security;

drop policy if exists "Allow own shortlist read access" on public.shortlists;
drop policy if exists "Allow own shortlist insert" on public.shortlists;
drop policy if exists "Allow own shortlist delete" on public.shortlists;

create policy "Allow own shortlist read access" on public.shortlists for select
using (auth.uid() = user_id);

create policy "Allow own shortlist insert" on public.shortlists for insert
with check (auth.uid() = user_id);

create policy "Allow own shortlist delete" on public.shortlists for delete
using (auth.uid() = user_id);
