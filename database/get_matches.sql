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
    select target_profile.budget,
           target_profile.cleanliness,
           target_profile.sleep_time,
           target_profile.diet,
           target_profile.smoking,
           target_profile.drinking,
           target_profile.city
    into t_budget, t_cleanliness, t_sleep_time, t_diet, t_smoking, t_drinking, t_city
    from public.profiles target_profile
    where target_profile.user_id = $1;

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
        'is_shortlisted', exists (
            select 1
            from public.shortlists s
            where s.user_id = $1
            and s.target_id = p.user_id
        ),
        'summary', concat('Overall roommate compatibility matches well across lifestyle factors.'),
        'riskLevel', 'Low',
        'fitCategories', jsonb_build_object('practical', 85, 'lifestyle', 80, 'comfort', 90),
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
