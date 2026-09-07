-- Workout Tracker schema for the static Family Game Night PWA.
-- REVIEW AND RUN MANUALLY in the Supabase SQL Editor before using workouts.html.
--
-- Security model: the selected person is an honor-system client preference.
-- There is no authentication, so anonymous users of the application can read,
-- add, and remove workout records.

begin;

create extension if not exists pgcrypto;

create table if not exists public.workout_results (
    id uuid primary key default gen_random_uuid(),
    workout_date date not null,
    person text not null
        check (person in ('Evan', 'Scarlet', 'Mom')),
    created_at timestamptz not null default now(),
    constraint workout_results_one_credit_per_day
        unique (workout_date, person)
);

create index if not exists workout_results_month_standings_idx
    on public.workout_results (workout_date desc, person);

create or replace function public.reject_future_workout_result()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    if new.workout_date > current_date then
        raise exception 'Workout dates cannot be in the future.';
    end if;

    return new;
end;
$$;

drop trigger if exists reject_future_workout_result on public.workout_results;
create trigger reject_future_workout_result
before insert or update on public.workout_results
for each row execute function public.reject_future_workout_result();

alter table public.workout_results enable row level security;

grant usage on schema public to anon;

drop policy if exists "workout_results_anon_select" on public.workout_results;
create policy "workout_results_anon_select"
on public.workout_results for select to anon
using (true);

drop policy if exists "workout_results_anon_insert" on public.workout_results;
create policy "workout_results_anon_insert"
on public.workout_results for insert to anon
with check (
    person in ('Evan', 'Scarlet', 'Mom')
    and workout_date <= current_date
);

drop policy if exists "workout_results_anon_delete" on public.workout_results;
create policy "workout_results_anon_delete"
on public.workout_results for delete to anon
using (true);

revoke all on table public.workout_results from public, anon;
grant select, insert, delete on table public.workout_results to anon;

revoke execute on function public.reject_future_workout_result() from public, anon;

comment on table public.workout_results is
    'One date-only workout credit per person per local calendar day.';
comment on column public.workout_results.workout_date is
    'Calendar date supplied by the client without timezone conversion.';
comment on constraint workout_results_one_credit_per_day
    on public.workout_results is
    'Prevents duplicate workout credit for the same person and date.';

commit;
