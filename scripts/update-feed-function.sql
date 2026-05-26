-- Run this in the Supabase SQL Editor to update get_personalised_feed
-- Adds profile-based score adjustments on top of peer sentiment scoring

drop function if exists get_personalised_feed(uuid);

create or replace function get_personalised_feed(user_uuid uuid)
returns table (
  id uuid,
  name text,
  cuisine text,
  neighbourhood text,
  price_range int,
  is_chain boolean,
  match_score numeric,
  top_tags text[]
)
language plpgsql
as $$
declare
  user_cluster text;
begin
  select cluster into user_cluster
  from profiles
  where profiles.id = user_uuid;

  return query
  with peer_scores as (
    -- Sentiment score from same-cluster peers
    select
      rev.restaurant_id,
      sum(
        case
          when rev.would_go_back = true  then  20
          when rev.would_go_back = false then -15
          else 10
        end
      ) as peer_score
    from reviews rev
    where rev.user_id in (
      select profiles.id from profiles
      where profiles.cluster = user_cluster
        and profiles.id != user_uuid
    )
    group by rev.restaurant_id
  ),
  restaurant_tags as (
    -- All distinct tags ever applied to each restaurant
    select
      t.restaurant_id,
      array_agg(distinct t.tag) filter (where t.tag is not null) as tags
    from (
      select rev.restaurant_id, unnest(coalesce(rev.tags, '{}')) as tag
      from reviews rev
    ) t
    group by t.restaurant_id
  )
  select
    r.id,
    r.name,
    r.cuisine,
    r.neighbourhood,
    r.price_range,
    r.is_chain,
    least(95, greatest(10,
      50::numeric

      -- Peer sentiment
      + coalesce(ps.peer_score, 0)::numeric

      -- Profile-based adjustments (flat additive CASE expressions)
      + case when user_cluster = 'adventurous' and r.is_chain            then -20 else 0 end
      + case when user_cluster = 'adventurous' and r.price_range >= 4    then -10 else 0 end

      + case when user_cluster = 'fine_dining' and r.is_chain            then -25 else 0 end
      + case when user_cluster = 'fine_dining' and r.price_range = 5     then  20 else 0 end
      + case when user_cluster = 'fine_dining' and r.price_range = 4     then  12 else 0 end
      + case when user_cluster = 'fine_dining' and r.price_range = 3     then   5 else 0 end
      + case when user_cluster = 'fine_dining' and r.price_range <= 2    then -20 else 0 end

      + case when user_cluster = 'comfort'     and r.is_chain            then  20 else 0 end
      + case when user_cluster = 'comfort'     and r.price_range <= 2    then  10 else 0 end
      + case when user_cluster = 'comfort'     and r.price_range >= 4    then -15 else 0 end

      + case when user_cluster = 'casual'      and r.price_range = 5     then -10 else 0 end

    )) as match_score,
    coalesce(rt.tags, '{}') as top_tags

  from restaurants r
  left join peer_scores ps       on ps.restaurant_id = r.id
  left join restaurant_tags rt   on rt.restaurant_id = r.id

  where r.status = 'approved'
    and not exists (
      select 1 from reviews
      where user_id = user_uuid
        and restaurant_id = r.id
    )

  order by match_score desc
  limit 30;
end;
$$;
