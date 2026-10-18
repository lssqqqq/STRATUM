-- STRATUM: таблица стратегий + защита. Можно запускать повторно, ничего не сломается.

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  author text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- поля, которые есть у тактик на сайте
alter table public.strategies add column if not exists google_docs_url text not null default '';
alter table public.strategies add column if not exists towers text[] not null default '{}';

alter table public.strategies enable row level security;

grant select on public.strategies to anon, authenticated;
grant insert, update, delete on public.strategies to authenticated;

-- читать могут все
drop policy if exists "public read" on public.strategies;
create policy "public read"
on public.strategies for select
using (true);

-- добавлять, менять и удалять могут только эти двое
drop policy if exists "admin write" on public.strategies;
create policy "admin write"
on public.strategies for all
to authenticated
using (auth.uid() in ('38b1d888-3a7e-4e07-84d0-67eb168b00a8', 'b64a3199-d350-4183-b457-8cf495b43467'))
with check (auth.uid() in ('38b1d888-3a7e-4e07-84d0-67eb168b00a8', 'b64a3199-d350-4183-b457-8cf495b43467'));
