-- Gift Card Tracker schema for the static Family Game Night PWA.
-- REVIEW AND RUN MANUALLY in the Supabase SQL Editor before using gift-cards.html.
--
-- Security model: the profile picker is only a client-side filter. There is no
-- authentication, so the anonymous policies intentionally let anyone with the
-- public project URL/key read and change tracker data. Never store card numbers,
-- PINs, redemption codes, or payment credentials in these tables.

begin;

create extension if not exists pgcrypto;

create table if not exists public.gift_cards (
    id uuid primary key default gen_random_uuid(),
    owner text not null
        check (owner in ('Evan/Scarlet', 'Mom', 'Brina/Ryan')),
    merchant text not null
        check (char_length(btrim(merchant)) between 1 and 100),
    nickname text
        check (nickname is null or char_length(btrim(nickname)) between 1 and 100),
    initial_balance_cents bigint not null
        check (initial_balance_cents > 0),
    manually_archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.gift_card_purchases (
    id uuid primary key default gen_random_uuid(),
    gift_card_id uuid not null
        references public.gift_cards(id) on delete restrict,
    amount_cents bigint not null
        check (amount_cents > 0),
    purchased_on date not null default current_date,
    location text
        check (location is null or char_length(btrim(location)) between 1 and 120),
    note text
        check (note is null or char_length(btrim(note)) between 1 and 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.gift_card_balance_corrections (
    id uuid primary key default gen_random_uuid(),
    gift_card_id uuid not null
        references public.gift_cards(id) on delete restrict,
    previous_balance_cents bigint not null,
    corrected_balance_cents bigint not null
        check (corrected_balance_cents >= 0),
    adjustment_cents bigint not null,
    created_at timestamptz not null default now(),
    constraint gift_card_correction_matches_difference
        check (adjustment_cents = corrected_balance_cents - previous_balance_cents)
);

create index if not exists gift_cards_owner_activity_idx
    on public.gift_cards (owner, updated_at desc);

create index if not exists gift_card_purchases_card_date_idx
    on public.gift_card_purchases (gift_card_id, purchased_on desc, created_at desc);

create index if not exists gift_card_corrections_card_created_idx
    on public.gift_card_balance_corrections (gift_card_id, created_at desc);

create or replace function public.set_gift_card_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_gift_cards_updated_at on public.gift_cards;
create trigger set_gift_cards_updated_at
before update on public.gift_cards
for each row execute function public.set_gift_card_updated_at();

drop trigger if exists set_gift_card_purchases_updated_at on public.gift_card_purchases;
create trigger set_gift_card_purchases_updated_at
before update on public.gift_card_purchases
for each row execute function public.set_gift_card_updated_at();

alter table public.gift_cards enable row level security;
alter table public.gift_card_purchases enable row level security;
alter table public.gift_card_balance_corrections enable row level security;

grant usage on schema public to anon;

-- Least-privilege table and RPC grants are finalized below.

drop policy if exists "gift_cards_anon_select" on public.gift_cards;
create policy "gift_cards_anon_select"
on public.gift_cards for select to anon
using (true);

drop policy if exists "gift_cards_anon_insert" on public.gift_cards;
create policy "gift_cards_anon_insert"
on public.gift_cards for insert to anon
with check (owner in ('Evan/Scarlet', 'Mom', 'Brina/Ryan'));

drop policy if exists "gift_cards_anon_update" on public.gift_cards;
create policy "gift_cards_anon_update"
on public.gift_cards for update to anon
using (true)
with check (owner in ('Evan/Scarlet', 'Mom', 'Brina/Ryan'));

drop policy if exists "gift_cards_anon_delete" on public.gift_cards;
create policy "gift_cards_anon_delete"
on public.gift_cards for delete to anon
using (true);

drop policy if exists "gift_card_purchases_anon_select" on public.gift_card_purchases;
create policy "gift_card_purchases_anon_select"
on public.gift_card_purchases for select to anon
using (true);

drop policy if exists "gift_card_corrections_anon_select" on public.gift_card_balance_corrections;
create policy "gift_card_corrections_anon_select"
on public.gift_card_balance_corrections for select to anon
using (true);

comment on table public.gift_cards is
    'Gift-card metadata only. Never store card numbers, PINs, codes, or payment credentials.';
comment on table public.gift_card_purchases is
    'Purchase ledger entries stored in integer cents.';
comment on table public.gift_card_balance_corrections is
    'Immutable balance-adjustment ledger entries that preserve purchase history.';

-- Transactional balance contract
--
-- Every purchase mutation and correction locks the same parent gift_cards row.
-- The helper below only calculates the agreed additive ledger formula; callers
-- must acquire the parent lock first.
-- JavaScript checks are only friendly prevalidation; these functions enforce
-- the invariants. Corrections stay additive, so later edits or deletes of older
-- purchases can change the current balance without rewriting correction history.
create or replace function public.gift_card_calculated_balance(
    p_gift_card_id uuid
)
returns bigint
language sql
stable
set search_path = pg_catalog
as $$
    select
        card.initial_balance_cents
        - coalesce((
            select sum(purchase.amount_cents)
            from public.gift_card_purchases as purchase
            where purchase.gift_card_id = card.id
        ), 0)
        + coalesce((
            select sum(correction.adjustment_cents)
            from public.gift_card_balance_corrections as correction
            where correction.gift_card_id = card.id
        ), 0)
    from public.gift_cards as card
    where card.id = p_gift_card_id;
$$;

create or replace function public.create_gift_card_purchase(
    p_gift_card_id uuid,
    p_amount_cents bigint,
    p_purchased_on date,
    p_location text,
    p_note text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    v_manually_archived boolean;
    v_current_balance bigint;
    v_purchase_id uuid;
begin
    if p_amount_cents is null or p_amount_cents <= 0 then
        raise exception 'The purchase amount must be greater than zero.';
    end if;

    if p_purchased_on is null then
        raise exception 'A purchase date is required.';
    end if;

    select card.manually_archived
    into v_manually_archived
    from public.gift_cards as card
    where card.id = p_gift_card_id
    for update;

    if not found then
        raise exception 'That gift card no longer exists.';
    end if;

    if v_manually_archived then
        raise exception 'Purchases cannot be recorded against an archived card.';
    end if;

    v_current_balance := public.gift_card_calculated_balance(p_gift_card_id);

    if p_amount_cents > v_current_balance then
        raise exception 'This purchase exceeds the current remaining balance of % cents.',
            v_current_balance;
    end if;

    insert into public.gift_card_purchases (
        gift_card_id,
        amount_cents,
        purchased_on,
        location,
        note
    )
    values (
        p_gift_card_id,
        p_amount_cents,
        p_purchased_on,
        nullif(btrim(p_location), ''),
        nullif(btrim(p_note), '')
    )
    returning id into v_purchase_id;

    return v_purchase_id;
end;
$$;

create or replace function public.update_gift_card_purchase(
    p_purchase_id uuid,
    p_amount_cents bigint,
    p_purchased_on date,
    p_location text,
    p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    v_card_id uuid;
    v_locked_card_id uuid;
    v_old_amount bigint;
    v_manually_archived boolean;
    v_current_balance bigint;
begin
    if p_amount_cents is null or p_amount_cents <= 0 then
        raise exception 'The purchase amount must be greater than zero.';
    end if;

    if p_purchased_on is null then
        raise exception 'A purchase date is required.';
    end if;

    select purchase.gift_card_id
    into v_card_id
    from public.gift_card_purchases as purchase
    where purchase.id = p_purchase_id;

    if not found then
        raise exception 'That purchase no longer exists.';
    end if;

    select card.manually_archived
    into v_manually_archived
    from public.gift_cards as card
    where card.id = v_card_id
    for update;

    if not found then
        raise exception 'That gift card no longer exists.';
    end if;

    select purchase.gift_card_id, purchase.amount_cents
    into v_locked_card_id, v_old_amount
    from public.gift_card_purchases as purchase
    where purchase.id = p_purchase_id
    for update;

    if not found then
        raise exception 'That purchase no longer exists.';
    end if;

    if v_locked_card_id <> v_card_id then
        raise exception 'The purchase changed cards during the update. Please retry.';
    end if;

    if v_manually_archived then
        raise exception 'Purchases cannot be edited against an archived card.';
    end if;

    v_current_balance := public.gift_card_calculated_balance(v_card_id);

    if p_amount_cents > v_current_balance + v_old_amount then
        raise exception 'The edited purchase exceeds the available balance of % cents.',
            v_current_balance + v_old_amount;
    end if;

    update public.gift_card_purchases
    set amount_cents = p_amount_cents,
        purchased_on = p_purchased_on,
        location = nullif(btrim(p_location), ''),
        note = nullif(btrim(p_note), '')
    where id = p_purchase_id;
end;
$$;

create or replace function public.delete_gift_card_purchase(
    p_purchase_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    v_card_id uuid;
    v_locked_card_id uuid;
begin
    select purchase.gift_card_id
    into v_card_id
    from public.gift_card_purchases as purchase
    where purchase.id = p_purchase_id;

    if not found then
        raise exception 'That purchase no longer exists.';
    end if;

    perform 1
    from public.gift_cards as card
    where card.id = v_card_id
    for update;

    if not found then
        raise exception 'That gift card no longer exists.';
    end if;

    select purchase.gift_card_id
    into v_locked_card_id
    from public.gift_card_purchases as purchase
    where purchase.id = p_purchase_id
    for update;

    if not found then
        raise exception 'That purchase no longer exists.';
    end if;

    if v_locked_card_id <> v_card_id then
        raise exception 'The purchase changed cards during deletion. Please retry.';
    end if;

    delete from public.gift_card_purchases
    where id = p_purchase_id;
end;
$$;

create or replace function public.correct_gift_card_balance(
    p_gift_card_id uuid,
    p_corrected_balance_cents bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    v_current_balance bigint;
    v_correction_id uuid;
begin
    if p_corrected_balance_cents is null or p_corrected_balance_cents < 0 then
        raise exception 'The corrected balance cannot be negative.';
    end if;

    perform 1
    from public.gift_cards as card
    where card.id = p_gift_card_id
    for update;

    if not found then
        raise exception 'That gift card no longer exists.';
    end if;

    v_current_balance := public.gift_card_calculated_balance(p_gift_card_id);

    if p_corrected_balance_cents = v_current_balance then
        raise exception 'The balance already matches that amount.';
    end if;

    insert into public.gift_card_balance_corrections (
        gift_card_id,
        previous_balance_cents,
        corrected_balance_cents,
        adjustment_cents
    )
    values (
        p_gift_card_id,
        v_current_balance,
        p_corrected_balance_cents,
        p_corrected_balance_cents - v_current_balance
    )
    returning id into v_correction_id;

    return v_correction_id;
end;
$$;

-- Reset any broader grants from an earlier draft. Anonymous purchase and
-- correction writes must go through the functions above.
revoke all on table public.gift_cards from public, anon;
grant select, insert, delete on table public.gift_cards to anon;
grant update (merchant, nickname, manually_archived) on table public.gift_cards to anon;

revoke all on table public.gift_card_purchases from public, anon;
grant select on table public.gift_card_purchases to anon;

revoke all on table public.gift_card_balance_corrections from public, anon;
grant select on table public.gift_card_balance_corrections to anon;

drop policy if exists "gift_card_purchases_anon_insert" on public.gift_card_purchases;
drop policy if exists "gift_card_purchases_anon_update" on public.gift_card_purchases;
drop policy if exists "gift_card_purchases_anon_delete" on public.gift_card_purchases;

drop policy if exists "gift_card_corrections_anon_insert" on public.gift_card_balance_corrections;
drop policy if exists "gift_card_corrections_anon_update" on public.gift_card_balance_corrections;
drop policy if exists "gift_card_corrections_anon_delete" on public.gift_card_balance_corrections;

revoke execute on function public.set_gift_card_updated_at() from public, anon;
revoke execute on function public.gift_card_calculated_balance(uuid) from public, anon;
revoke execute on function public.create_gift_card_purchase(uuid, bigint, date, text, text) from public, anon;
revoke execute on function public.update_gift_card_purchase(uuid, bigint, date, text, text) from public, anon;
revoke execute on function public.delete_gift_card_purchase(uuid) from public, anon;
revoke execute on function public.correct_gift_card_balance(uuid, bigint) from public, anon;

grant execute on function public.create_gift_card_purchase(uuid, bigint, date, text, text) to anon;
grant execute on function public.update_gift_card_purchase(uuid, bigint, date, text, text) to anon;
grant execute on function public.delete_gift_card_purchase(uuid) to anon;
grant execute on function public.correct_gift_card_balance(uuid, bigint) to anon;

comment on table public.gift_card_purchases is
    'Purchase ledger entries in integer cents. Anonymous writes use transactional RPCs.';
comment on table public.gift_card_balance_corrections is
    'Immutable additive corrections; later purchase edits or deletes can change the current balance.';
comment on function public.create_gift_card_purchase(uuid, bigint, date, text, text) is
    'Locks the card and atomically rejects a purchase that would make its balance negative.';
comment on function public.update_gift_card_purchase(uuid, bigint, date, text, text) is
    'Locks the card, accounts for the old amount, and atomically validates a purchase edit.';
comment on function public.delete_gift_card_purchase(uuid) is
    'Locks the card before deleting a purchase so ledger mutations serialize.';
comment on function public.correct_gift_card_balance(uuid, bigint) is
    'Locks the card and derives an immutable additive correction from authoritative data.';
commit;
