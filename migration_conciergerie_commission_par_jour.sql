-- ============================================================================
-- migration_conciergerie_commission_par_jour.sql
-- ----------------------------------------------------------------------------
-- Suite de migration_conciergerie_livraison.sql. À exécuter UNE FOIS dans le
-- SQL Editor de Supabase. Idempotent : ré-exécutable sans effet de bord.
--
-- 1) COMMISSION « PAR JOUR »
--    Nouveau barème `per_day` : l'agence gagne un montant fixe (DA) pour CHAQUE
--    jour loué. Ex. 1 000 DA/jour ⇒ 3 000 DA pour une location de 3 jours.
--    - `car_owners.commission_type` accepte désormais 'per_day' ;
--    - le snapshot de commission (au passage en `completed`) calcule
--      commission_amount = commission_value × total_days.
--
-- 2) FRAIS DE LIVRAISON PARAMÉTRABLES PAR VÉHICULE
--    Chaque véhicule en conciergerie porte ses propres réglages de livraison :
--    - `delivery_fee_enabled`    : livraison automatique activée (défaut true) ;
--    - `delivery_threshold_days` : durée à partir de laquelle elle s'ajoute (10) ;
--    - `delivery_fee_amount`     : montant en DA (300).
--    Le trigger qui fixe le payeur utilise désormais le seuil du véhicule.
-- ============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) COMMISSION : autoriser 'per_day' sur car_owners.commission_type
--    On remplace la contrainte CHECK existante (quel que soit son nom).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'car_owners'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%commission_type%'
  loop
    execute format('alter table public.car_owners drop constraint %I', c.conname);
  end loop;

  alter table public.car_owners
    add constraint car_owners_commission_type_check
    check (commission_type in ('amount', 'percentage', 'per_day'));
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 2) FRAIS DE LIVRAISON : réglages par véhicule (sur car_owners)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.car_owners
  add column if not exists delivery_fee_enabled    boolean not null default true,
  add column if not exists delivery_threshold_days integer not null default 10,
  add column if not exists delivery_fee_amount      numeric not null default 300;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'car_owners_delivery_threshold_check'
  ) then
    alter table public.car_owners
      add constraint car_owners_delivery_threshold_check
      check (delivery_threshold_days >= 1);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'car_owners_delivery_fee_amount_check'
  ) then
    alter table public.car_owners
      add constraint car_owners_delivery_fee_amount_check
      check (delivery_fee_amount >= 0);
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 3) SNAPSHOT DE COMMISSION — gérer le barème 'per_day'
--    percentage  → total_price × valeur / 100
--    per_day     → valeur × total_days (min. 1 jour)
--    amount      → valeur (fixe par location)
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
        when v_owner.commission_type = 'per_day'
          then round(v_owner.commission_value * greatest(coalesce(new.total_days, 1), 1), 2)
        else round(v_owner.commission_value, 2)
      end;
    end if;
  end if;
  return new;
end;
$$;

-- (le trigger trg_reservations_commission_snapshot existe déjà)


-- ─────────────────────────────────────────────────────────────────────────
-- 4) PAYEUR DE LA LIVRAISON — utiliser le seuil du véhicule
--    À partir de `delivery_threshold_days` (défaut 10), la livraison est à la
--    charge du propriétaire ; en dessous, elle est facturée au client.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_delivery_fee_payer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_threshold int := 10;
begin
  if coalesce(new.delivery_fee, 0) > 0 then
    select coalesce(o.delivery_threshold_days, 10)
      into v_threshold
      from public.car_owners o
      join public.cars c on c.id = o.car_id
     where o.car_id = new.car_id
       and c.ownership_type = 'consignment'
     limit 1;

    if v_threshold is null then
      v_threshold := 10;
    end if;

    if coalesce(new.total_days, 0) >= v_threshold then
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

-- (le trigger trg_reservations_delivery_fee_payer existe déjà)

commit;

-- ============================================================================
-- Vérifications (optionnel)
--   select commission_type, delivery_fee_enabled, delivery_threshold_days,
--          delivery_fee_amount
--     from public.car_owners;
-- ============================================================================
