-- STRATUM: лайки стратегий. Можно запускать повторно, ничего не сломается.
-- Выполнить в Supabase: SQL Editor -> New query -> вставить -> Run.

create table if not exists public.strategy_likes (
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  voter_id    uuid not null,
  created_at  timestamptz not null default now(),
  primary key (strategy_id, voter_id)
);

-- Напрямую в таблицу никто не ходит: RLS включён, политик нет, права отозваны.
-- Всё идёт через две функции ниже.
alter table public.strategy_likes enable row level security;
revoke all on table public.strategy_likes from anon, authenticated;

-- Счётчики лайков по всем стратегиям + какие из них лайкнул этот браузер.
create or replace function public.get_strategy_likes(p_voter uuid)
returns table (out_strategy_id uuid, out_count bigint, out_liked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.strategy_id, count(*)::bigint, coalesce(bool_or(l.voter_id = p_voter), false)
  from public.strategy_likes l
  group by l.strategy_id;
$$;

-- Поставить лайк, а если уже стоит, то снять.
create or replace function public.toggle_strategy_like(p_strategy uuid, p_voter uuid)
returns table (out_count bigint, out_liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liked boolean;
begin
  if exists (
    select 1 from public.strategy_likes
    where strategy_id = p_strategy and voter_id = p_voter
  ) then
    delete from public.strategy_likes
    where strategy_id = p_strategy and voter_id = p_voter;
    v_liked := false;
  else
    insert into public.strategy_likes (strategy_id, voter_id)
    values (p_strategy, p_voter)
    on conflict do nothing;
    v_liked := true;
  end if;

  return query
    select count(*)::bigint, v_liked
    from public.strategy_likes
    where strategy_id = p_strategy;
end;
$$;

revoke all on function public.get_strategy_likes(uuid) from public;
revoke all on function public.toggle_strategy_like(uuid, uuid) from public;
grant execute on function public.get_strategy_likes(uuid) to anon, authenticated;
grant execute on function public.toggle_strategy_like(uuid, uuid) to anon, authenticated;
