-- ============================================================
-- Hey Nomads - Supabase Messages Migration
-- Run this script after migrate_supabase.sql
-- Do not run until frontend messaging has been switched from legacy /api routes.
-- ============================================================

-- 1. Messages Table
create table if not exists public.messages (
    id uuid default gen_random_uuid() primary key,
    sender_id uuid not null references auth.users(id) on delete cascade,
    receiver_id uuid not null references auth.users(id) on delete cascade,
    message text not null,
    read_at timestamp with time zone default null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    check (sender_id <> receiver_id),
    check (length(btrim(message)) > 0),
    check (char_length(message) <= 5000)
);

-- 2. Indexes
create index if not exists messages_sender_receiver_created_at_idx
on public.messages (sender_id, receiver_id, created_at);

create index if not exists messages_receiver_sender_created_at_idx
on public.messages (receiver_id, sender_id, created_at);

create index if not exists messages_sender_created_at_idx
on public.messages (sender_id, created_at desc);

create index if not exists messages_receiver_created_at_idx
on public.messages (receiver_id, created_at desc);

create index if not exists messages_unread_receiver_idx
on public.messages (receiver_id, created_at desc)
where read_at is null;

-- 3. Stored Procedure: send_message
create or replace function public.send_message(
    p_receiver_id uuid,
    p_message text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_message public.messages;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if p_receiver_id is null or p_receiver_id = auth.uid() then
        raise exception 'Invalid receiver';
    end if;

    if p_message is null or length(btrim(p_message)) = 0 then
        raise exception 'Message is required';
    end if;

    insert into public.messages (sender_id, receiver_id, message)
    values (auth.uid(), p_receiver_id, btrim(p_message))
    returning * into v_message;

    return jsonb_build_object(
        'id', v_message.id,
        'sender_id', v_message.sender_id,
        'receiver_id', v_message.receiver_id,
        'message', v_message.message,
        'read_at', v_message.read_at,
        'created_at', v_message.created_at
    );
end;
$$;

-- 4. Stored Procedure: get_conversation_messages
create or replace function public.get_conversation_messages(
    p_other_user_id uuid,
    p_limit int default 100,
    p_before timestamp with time zone default null
) returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if p_other_user_id is null or p_other_user_id = auth.uid() then
        raise exception 'Invalid conversation user';
    end if;

    return query
    select recent.row_data
    from (
        select
            jsonb_build_object(
                'id', m.id,
                'sender_id', m.sender_id,
                'receiver_id', m.receiver_id,
                'message', m.message,
                'read_at', m.read_at,
                'created_at', m.created_at,
                'sender_name', coalesce(s.raw_user_meta_data->>'name', split_part(s.email, '@', 1)),
                'receiver_name', coalesce(r.raw_user_meta_data->>'name', split_part(r.email, '@', 1))
            ) as row_data,
            m.created_at
        from public.messages m
        join auth.users s on s.id = m.sender_id
        join auth.users r on r.id = m.receiver_id
        where (
            (m.sender_id = auth.uid() and m.receiver_id = p_other_user_id)
            or
            (m.sender_id = p_other_user_id and m.receiver_id = auth.uid())
        )
        and (p_before is null or m.created_at < p_before)
        order by m.created_at desc
        limit least(greatest(coalesce(p_limit, 100), 1), 200)
    ) recent
    order by recent.created_at asc;
end;
$$;

-- 5. Stored Procedure: get_conversations
create or replace function public.get_conversations()
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    t_budget int;
    t_cleanliness int;
    t_sleep_time varchar;
    t_diet varchar;
    t_smoking varchar;
    t_drinking varchar;
    t_city varchar;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    -- Get current user's profile attributes for compatibility scoring
    select budget, cleanliness, sleep_time, diet, smoking, drinking, city
    into t_budget, t_cleanliness, t_sleep_time, t_diet, t_smoking, t_drinking, t_city
    from public.profiles
    where profiles.user_id = auth.uid();

    return query
    with message_partners as (
        select
            case
                when m.sender_id = auth.uid() then m.receiver_id
                else m.sender_id
            end as partner_id,
            m.id,
            m.message,
            m.sender_id,
            m.receiver_id,
            m.read_at,
            m.created_at
        from public.messages m
        where m.sender_id = auth.uid() or m.receiver_id = auth.uid()
    ),
    ranked as (
        select
            mp.*,
            row_number() over (
                partition by mp.partner_id
                order by mp.created_at desc, mp.id desc
            ) as rn
        from message_partners mp
    ),
    unread as (
        select
            m.sender_id as partner_id,
            count(*) as unread_count
        from public.messages m
        where m.receiver_id = auth.uid()
        and m.read_at is null
        group by m.sender_id
    )
    select jsonb_build_object(
        'id', p.user_id,
        'user_id', p.user_id,
        'name', coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
        'email', u.email,
        'profile_image', p.profile_image,
        'city', p.city,
        'occupation', p.occupation,
        'is_verified', p.is_verified,
        'last_message', r.message,
        'last_message_time', r.created_at,
        'last_message_from_me', r.sender_id = auth.uid(),
        'unread_count', coalesce(unread.unread_count, 0),
        'score', (
            (case when t_city is not null and lower(p.city) = lower(t_city) then 30 else 0 end) +
            (case when coalesce(greatest(p.budget, t_budget), 0) > 0 then
                round(20 * (1 - abs(coalesce(p.budget, 0) - coalesce(t_budget, 0))::numeric / greatest(p.budget, t_budget)))
             else 10 end) +
            (20 - abs(coalesce(p.cleanliness, 3) - coalesce(t_cleanliness, 3)) * 5) +
            (case when p.sleep_time = t_sleep_time then 10 else 0 end) +
            (case when p.smoking = t_smoking then 10 else 0 end) +
            (case when p.drinking = t_drinking then 10 else 0 end) +
            (case when p.diet = t_diet then 5 else 0 end)
        )
    )
    from ranked r
    join public.profiles p on p.user_id = r.partner_id
    join auth.users u on u.id = p.user_id
    left join unread on unread.partner_id = r.partner_id
    where r.rn = 1
    order by r.created_at desc;
end;
$$;

-- 6. Stored Procedure: mark_conversation_read
create or replace function public.mark_conversation_read(
    p_other_user_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    update public.messages
    set read_at = timezone('utc'::text, now())
    where sender_id = p_other_user_id
    and receiver_id = auth.uid()
    and read_at is null;

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

-- 7. Enable row-level security (RLS)
alter table public.messages enable row level security;

drop policy if exists "Allow participants to read own messages" on public.messages;
drop policy if exists "Allow authenticated users to send own messages" on public.messages;
drop policy if exists "Allow receivers to mark messages read" on public.messages;

create policy "Allow participants to read own messages" on public.messages for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Allow authenticated users to send own messages" on public.messages for insert
with check (
    auth.uid() = sender_id
    and auth.uid() <> receiver_id
    and length(btrim(message)) > 0
);

-- Read receipts must be updated through public.mark_conversation_read(uuid).
revoke update on public.messages from authenticated;

grant execute on function public.mark_conversation_read(uuid) to authenticated;
