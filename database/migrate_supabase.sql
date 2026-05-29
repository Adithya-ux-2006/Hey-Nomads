-- ============================================================
-- Hey Nomads — Complete Supabase Database Migration
-- Run this script in the Supabase SQL Editor to initialize all tables
-- ============================================================

-- 1. Clean up existing objects (safe reset if needed)
drop function if exists public.get_matches(uuid, text);
drop function if exists public.get_profile(uuid);
drop table if exists public.preferences cascade;
drop table if exists public.user_languages cascade;
drop table if exists public.languages cascade;
drop table if exists public.profiles cascade;

-- 2. Profiles Table
create table public.profiles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade unique,
    bio text default null,
    occupation varchar(100) default null,
    city varchar(100) default null,
    profile_image varchar(255) default null,
    move_in_date date default null,
    sleep_time varchar(20) not null default 'flexible' check (sleep_time in ('early', 'late', 'flexible')),
    cleanliness int not null default 3 check (cleanliness between 1 and 5),
    diet varchar(20) not null default 'veg' check (diet in ('veg', 'nonveg', 'eggetarian', 'vegan')),
    noise_tolerance varchar(20) not null default 'moderate' check (noise_tolerance in ('quiet', 'moderate', 'loud')),
    noise_level int default 3,
    budget int not null default 15000,
    tax_bracket varchar(20) default 'medium' check (tax_bracket in ('low', 'medium', 'high')),
    deposit int default 5000,
    flat_type varchar(20) default 'shared' check (flat_type in ('1BHK', '2BHK', '3BHK', 'shared', 'studio', 'other')),
    occupants int default 1,
    smoking varchar(10) default 'no' check (smoking in ('yes', 'no')),
    drinking varchar(10) default 'no' check (drinking in ('yes', 'no')),
    partying varchar(10) default 'low' check (partying in ('low', 'medium', 'high')),
    is_verified boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Languages Table
create table public.languages (
    id serial primary key,
    name varchar(50) not null unique
);

-- 4. User Languages Junction Table
create table public.user_languages (
    id serial primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    language_id int not null references public.languages(id) on delete cascade,
    unique (user_id, language_id)
);

-- 5. Preferences Table
create table public.preferences (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade unique,
    preferred_gender varchar(20) default null,
    preferred_budget_min int default null,
    preferred_budget_max int default null,
    preferred_location_radius int default 10,
    prefers_smoking varchar(20) default 'no_preference' check (prefers_smoking in ('yes', 'no', 'no_preference')),
    prefers_drinking varchar(20) default 'no_preference' check (prefers_drinking in ('yes', 'no', 'no_preference')),
    prefers_cleanliness_min int default 1 check (prefers_cleanliness_min between 1 and 5),
    prefers_sleep_schedule varchar(20) default 'no_preference' check (prefers_sleep_schedule in ('early', 'late', 'flexible', 'no_preference')),
    prefers_same_diet boolean default false,
    prefers_same_sleep boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Insert Default Languages Seed
insert into public.languages (id, name) values
    (1, 'English'),
    (2, 'Hindi'),
    (3, 'Tamil'),
    (4, 'Telugu'),
    (5, 'Kannada'),
    (6, 'Malayalam'),
    (7, 'Marathi'),
    (8, 'Gujarati'),
    (9, 'Bengali'),
    (10, 'Punjabi'),
    (11, 'Urdu'),
    (12, 'Spanish'),
    (13, 'French'),
    (14, 'German'),
    (15, 'Other')
on conflict (id) do update set name = excluded.name;

-- 7. Stored Procedure: get_profile
create or replace function public.get_profile(p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
    v_profile jsonb;
    v_user jsonb;
    v_prefs jsonb;
    v_langs jsonb;
begin
    -- 1. Get auth user details
    select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'name', coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
    ) into v_user
    from auth.users u
    where u.id = p_user_id;

    if v_user is null then
        return null;
    end if;

    -- 2. Get profile details
    select to_jsonb(p) into v_profile
    from public.profiles p
    where p.user_id = p_user_id;

    if v_profile is null then
        v_profile := '{}'::jsonb;
    end if;

    -- 3. Get preferences
    select to_jsonb(pr) into v_prefs
    from public.preferences pr
    where pr.user_id = p_user_id;

    if v_prefs is null then
        v_prefs := '{}'::jsonb;
    end if;

    -- 4. Get languages
    select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name)), '[]'::jsonb) into v_langs
    from public.user_languages ul
    join public.languages l on l.id = ul.language_id
    where ul.user_id = p_user_id;

    return v_user 
        || jsonb_build_object('user_id', p_user_id)
        || v_profile 
        || v_prefs 
        || jsonb_build_object('languages', v_langs);
end;
$$;

-- 8. Stored Procedure: get_matches
create or replace function public.get_matches(
    user_id uuid,
    city text default null
) returns setof jsonb language plpgsql security definer as $$
declare
    t_budget int;
    t_cleanliness int;
    t_sleep_time varchar;
    t_diet varchar;
    t_smoking varchar;
    t_drinking varchar;
    t_city varchar;
begin
    -- Get target user attributes for compatibility scoring
    select budget, cleanliness, sleep_time, diet, smoking, drinking, city
    into t_budget, t_cleanliness, t_sleep_time, t_diet, t_smoking, t_drinking, t_city
    from public.profiles
    where profiles.user_id = $1;

    -- Return candidates set
    return query
    select jsonb_build_object(
        'id', p.user_id,
        'user_id', p.user_id,
        'name', coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
        'email', u.email,
        'bio', p.bio,
        'occupation', p.occupation,
        'city', p.city,
        'budget', p.budget,
        'deposit', p.deposit,
        'flat_type', p.flat_type,
        'occupants', p.occupants,
        'cleanliness', p.cleanliness,
        'sleep_time', p.sleep_time,
        'diet', p.diet,
        'smoking', p.smoking,
        'drinking', p.drinking,
        'partying', p.partying,
        'is_verified', p.is_verified,
        'profile_image', p.profile_image,
        'summary', concat('Overall roommate compatibility matches well across lifestyle factors.'),
        'riskLevel', 'Low',
        'fitCategories', jsonb_build_object('practical', 85, 'lifestyle', 80, 'comfort', 90),
        'score', (
            -- compatibility algorithm
            (case when t_city is not null and lower(p.city) = lower(t_city) then 30 else 0 end) +
            (case when coalesce(greatest(p.budget, t_budget), 0) > 0 then
                round(20 * (1 - abs(coalesce(p.budget, 0) - coalesce(t_budget, 0))::numeric / greatest(p.budget, t_budget)))
             else 10 end) +
            (20 - abs(coalesce(p.cleanliness, 3) - coalesce(t_cleanliness, 3)) * 5) +
            (case when p.sleep_time = t_sleep_time then 10 else 0 end) +
            (case when p.smoking = t_smoking then 10 else 0 end) +
            (case when p.drinking = t_drinking then 10 else 0 end) +
            (case when p.diet = t_diet then 5 else 0 end)
        ),
        'languages', coalesce(
            (select jsonb_agg(l.name) 
             from public.user_languages ul 
             join public.languages l on l.id = ul.language_id 
             where ul.user_id = p.user_id), 
            '[]'::jsonb
        )
    )
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.user_id <> $1
    and ($2 is null or $2 = '' or lower(p.city) like concat('%', lower($2), '%'));
end;
$$;

-- 9. Enable row-level security (RLS) policies so public reads/updates work
alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.languages enable row level security;
alter table public.user_languages enable row level security;

create policy "Allow public profiles read access" on public.profiles for select using (true);
create policy "Allow own profile update/insert" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Allow public preferences read access" on public.preferences for select using (true);
create policy "Allow own preferences update/insert" on public.preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Allow public languages read access" on public.languages for select using (true);

create policy "Allow public user_languages read access" on public.user_languages for select using (true);
create policy "Allow own user_languages update/insert" on public.user_languages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
