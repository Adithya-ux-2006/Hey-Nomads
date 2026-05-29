create or replace function public.get_matches(
    user_id uuid,
    city text default null
) returns setof jsonb language sql as $$
    with user_profile as (
        select * from profiles where user_id = user_id
    ),
    matches as (
        select p.*, u.email, u.name
        from profiles p
        join auth.users u on u.id = p.user_id
        where p.user_id <> user_id
        and (city is null or p.city = city)
    )
    select jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'name', u.name,
        'email', u.email,
        'city', p.city,
        'budget', p.budget,
        'cleanliness', p.cleanliness,
        'sleep_time', p.sleep_time,
        'diet', p.diet,
        'languages', (
            select array_agg(l.name) from user_languages ul join languages l on l.id = ul.language_id where ul.user_id = p.user_id
        )
    )
    from matches p
    join auth.users u on u.id = p.user_id;
$$;
