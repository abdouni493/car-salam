-- ============================================================================
-- migration_frais_longue_duree.sql
-- ----------------------------------------------------------------------------
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
-- Idempotent : ré-exécutable sans effet de bord.
--
-- FRAIS SUPPLÉMENTAIRES « LONGUE DURÉE »
--   À partir de 10 jours de location, l'agence facture au CLIENT un supplément
--   forfaitaire (3 000 DA par défaut) EN PLUS du prix de la location. Le montant
--   est proposé automatiquement au dernier écran de création de réservation, où
--   l'agence peut le désactiver (0) ou le modifier à la main.
--
--   Il est déjà compris dans `reservations.total_price` : la colonne ajoutée ici
--   sert à l'isoler dans les rapports et les contrats.
--
--   ⚠️ À ne pas confondre avec `delivery_fee` : les frais de livraison passent à
--   la charge du PROPRIÉTAIRE au-delà du seuil, alors que ce supplément est
--   toujours facturé au client.
-- ============================================================================

begin;

alter table public.reservations
  add column if not exists long_duration_fee numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_long_duration_fee_check'
  ) then
    alter table public.reservations
      add constraint reservations_long_duration_fee_check
      check (long_duration_fee >= 0);
  end if;
end $$;

comment on column public.reservations.long_duration_fee is
  'Supplément « longue durée » (DA) facturé au client à partir de 10 jours. '
  'Déjà compris dans total_price ; 0 = supplément désactivé.';

-- Le supplément n'a pas de sens sous le seuil : si la durée d'une réservation
-- repasse en dessous de 10 jours, on le remet à zéro (le formulaire applique la
-- même règle côté client — ce trigger garantit la cohérence en base).
create or replace function public.reset_long_duration_fee()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.total_days, 0) < 10 then
    new.long_duration_fee := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservations_long_duration_fee on public.reservations;
create trigger trg_reservations_long_duration_fee
  before insert or update of total_days, long_duration_fee on public.reservations
  for each row
  execute function public.reset_long_duration_fee();

commit;

-- ============================================================================
-- Vérification (optionnel)
--   select id, total_days, total_price, delivery_fee, long_duration_fee
--     from public.reservations
--    order by created_at desc
--    limit 20;
-- ============================================================================
