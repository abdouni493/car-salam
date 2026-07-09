-- ============================================================================
-- migration_conciergerie_livraison.sql
-- ----------------------------------------------------------------------------
-- 1) CONCIERGERIE : des propriétaires tiers confient leurs véhicules à l'agence,
--    qui les loue contre commission.
--
--    RÈGLE D'OR (sécurité) : le rôle `anon` possède un SELECT complet sur
--    `public.cars` (policy `cars_public_read`). Les données du propriétaire ne
--    doivent JAMAIS être lisibles depuis le site public. Elles vivent donc dans
--    une table séparée `public.car_owners` qui n'a AUCUNE policy anon —
--    uniquement `authenticated`.
--
-- 2) LIVRAISON : `reservations.delivery_fee` + `delivery_fee_payer`.
--    Un trigger fixe le payeur : location >= 10 jours -> le propriétaire du
--    véhicule prend les frais à sa charge ; sinon c'est le client.
--
-- 3) COMMISSION : figée (snapshot) sur la réservation au passage en `completed`,
--    afin qu'une modification ultérieure du taux ne réécrive pas l'historique.
--
-- Exécuter UNE FOIS dans le SQL Editor de Supabase. Idempotent : ré-exécutable.
-- ============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) COLONNES SUR `cars`
--    `ownership_type` distingue les véhicules de l'agence des véhicules confiés.
--    `description` est un texte PUBLIC (affiché sur le site).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.cars
  add column if not exists ownership_type text not null default 'personal',
  add column if not exists description    text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cars_ownership_type_check'
  ) then
    alter table public.cars
      add constraint cars_ownership_type_check
      check (ownership_type in ('personal', 'consignment'));
  end if;
end $$;

create index if not exists idx_cars_ownership_type on public.cars(ownership_type);


-- ─────────────────────────────────────────────────────────────────────────
-- 2) TABLE `car_owners` — DONNÉES PRIVÉES DU PROPRIÉTAIRE
--    Jamais exposée au rôle anon. Une ligne au maximum par véhicule.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.car_owners (
  id               uuid primary key default gen_random_uuid(),
  car_id           uuid not null unique references public.cars(id) on delete cascade,
  owner_name       text not null,
  owner_phone      text,
  internal_ref     text unique,                    -- CS-001, CS-002… (trigger)
  consignment_date date default current_date,
  commission_type  text not null default 'percentage'
                     check (commission_type in ('amount', 'percentage')),
  commission_value numeric not null default 0 check (commission_value >= 0),
  contract_url     text,
  private_notes    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_car_owners_car on public.car_owners(car_id);


-- 2.1 Génération automatique de la référence interne CS-001, CS-002…
create or replace function public.set_car_owner_internal_ref()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_next int;
begin
  if new.internal_ref is null or btrim(new.internal_ref) = '' then
    -- Reprend le plus grand numéro existant pour ne jamais réutiliser une réf.
    select coalesce(max((regexp_replace(internal_ref, '\D', '', 'g'))::int), 0) + 1
      into v_next
      from public.car_owners
     where internal_ref ~ '^CS-\d+$';

    new.internal_ref := 'CS-' || lpad(v_next::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_car_owners_internal_ref on public.car_owners;
create trigger trg_car_owners_internal_ref
  before insert on public.car_owners
  for each row execute function public.set_car_owner_internal_ref();


-- 2.2 `updated_at` auto
create or replace function public.touch_car_owner_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_car_owners_touch on public.car_owners;
create trigger trg_car_owners_touch
  before update on public.car_owners
  for each row execute function public.touch_car_owner_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 3) FRAIS DE LIVRAISON SUR `reservations`
-- ─────────────────────────────────────────────────────────────────────────
alter table public.reservations
  add column if not exists delivery_fee       numeric not null default 0,
  add column if not exists delivery_fee_payer text,
  add column if not exists commission_type    text,
  add column if not exists commission_value   numeric,
  add column if not exists commission_amount  numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_delivery_fee_payer_check'
  ) then
    alter table public.reservations
      add constraint reservations_delivery_fee_payer_check
      check (delivery_fee_payer is null or delivery_fee_payer in ('client', 'owner'));
  end if;
end $$;


-- 3.1 Trigger : à partir de 10 jours de location, la livraison est à la charge
--     du propriétaire du véhicule. En dessous, elle est facturée au client.
--     Sans frais de livraison, aucun payeur.
create or replace function public.set_delivery_fee_payer()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.delivery_fee, 0) > 0 then
    if coalesce(new.total_days, 0) >= 10 then
      new.delivery_fee_payer := 'owner';
    else
      new.delivery_fee_payer := 'client';
    end if;
  else
    new.delivery_fee_payer := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservations_delivery_fee_payer on public.reservations;
create trigger trg_reservations_delivery_fee_payer
  before insert or update of delivery_fee, total_days on public.reservations
  for each row execute function public.set_delivery_fee_payer();


-- ─────────────────────────────────────────────────────────────────────────
-- 4) SNAPSHOT DE LA COMMISSION AU PASSAGE EN `completed`
--    La commission est modifiable librement dans `car_owners`, mais une fois la
--    location terminée son montant est figé sur la réservation.
--
--    Assiette : total_price (ce que le client a payé pour la location).
--    Les frais de livraison à la charge du propriétaire ne sont PAS facturés au
--    client : ils sont déduits du reversement propriétaire (cf. vue § 5).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.snapshot_reservation_commission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner public.car_owners%rowtype;
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and new.commission_amount is null
  then
    select o.* into v_owner
      from public.car_owners o
      join public.cars c on c.id = o.car_id
     where o.car_id = new.car_id
       and c.ownership_type = 'consignment'
     limit 1;

    if found then
      new.commission_type  := v_owner.commission_type;
      new.commission_value := v_owner.commission_value;
      new.commission_amount := case
        when v_owner.commission_type = 'percentage'
          then round(coalesce(new.total_price, 0) * v_owner.commission_value / 100.0, 2)
        else round(v_owner.commission_value, 2)
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservations_commission_snapshot on public.reservations;
create trigger trg_reservations_commission_snapshot
  before insert or update of status on public.reservations
  for each row execute function public.snapshot_reservation_commission();


-- ─────────────────────────────────────────────────────────────────────────
-- 5) VUE ADMIN `consignment_earnings`
--    security_invoker : la vue s'exécute avec les droits de l'appelant, donc
--    `anon` ne peut rien en lire (aucune policy anon sur `car_owners`).
-- ─────────────────────────────────────────────────────────────────────────
drop view if exists public.consignment_earnings;
create view public.consignment_earnings
with (security_invoker = true)
as
select
  c.id                                as car_id,
  c.brand,
  c.model,
  c.plate_number,
  o.internal_ref,
  o.owner_name,
  o.owner_phone,
  o.commission_type,
  o.commission_value,
  count(r.id) filter (where r.status = 'completed')            as completed_rentals,
  coalesce(sum(r.total_price)      filter (where r.status = 'completed'), 0) as gross_revenue,
  coalesce(sum(r.commission_amount) filter (where r.status = 'completed'), 0) as agency_commission,
  coalesce(sum(r.delivery_fee)
           filter (where r.status = 'completed' and r.delivery_fee_payer = 'owner'), 0)
                                                                as owner_delivery_fees,
  coalesce(sum(r.total_price)       filter (where r.status = 'completed'), 0)
    - coalesce(sum(r.commission_amount) filter (where r.status = 'completed'), 0)
    - coalesce(sum(r.delivery_fee)
               filter (where r.status = 'completed' and r.delivery_fee_payer = 'owner'), 0)
                                                                as owner_payout
from public.cars c
join public.car_owners o on o.car_id = c.id
left join public.reservations r on r.car_id = c.id
where c.ownership_type = 'consignment'
group by c.id, c.brand, c.model, c.plate_number,
         o.internal_ref, o.owner_name, o.owner_phone,
         o.commission_type, o.commission_value;


-- ─────────────────────────────────────────────────────────────────────────
-- 6) ROW LEVEL SECURITY — `car_owners` : authenticated UNIQUEMENT.
--    Aucune policy pour `anon` : le site public ne peut RIEN lire ici.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.car_owners enable row level security;

drop policy if exists "car_owners_authenticated_all" on public.car_owners;
create policy "car_owners_authenticated_all"
  on public.car_owners for all to authenticated
  using (true) with check (true);

revoke all on public.car_owners from anon;
grant select, insert, update, delete on public.car_owners to authenticated;

revoke all on public.consignment_earnings from anon;
grant select on public.consignment_earnings to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 7) BUCKET `contracts` — contrats de conciergerie scannés.
--    Lecture/écriture réservées aux utilisateurs authentifiés (bucket privé).
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "contracts_read"   on storage.objects;
drop policy if exists "contracts_write"  on storage.objects;
drop policy if exists "contracts_update" on storage.objects;
drop policy if exists "contracts_delete" on storage.objects;

create policy "contracts_read"   on storage.objects for select to authenticated
  using (bucket_id = 'contracts');
create policy "contracts_write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts');
create policy "contracts_update" on storage.objects for update to authenticated
  using (bucket_id = 'contracts') with check (bucket_id = 'contracts');
create policy "contracts_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'contracts');

commit;

-- ============================================================================
-- Vérifications (optionnel)
--   -- Aucune donnée propriétaire lisible en anon :
--   set role anon; select * from public.car_owners;  -- doit renvoyer 0 ligne
--   reset role;
--
--   -- Références internes générées :
--   select internal_ref, owner_name from public.car_owners order by internal_ref;
--
--   -- Gains conciergerie :
--   select * from public.consignment_earnings;
-- ============================================================================
