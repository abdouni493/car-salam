-- ============================================================================
--  Tarifs en euros par véhicule + devise de règlement des réservations
--  ---------------------------------------------------------------------------
--  Le dinar reste la devise de référence : `cars.price_per_day`,
--  `reservations.total_price`, `advance_payment` et `remaining_payment`
--  continuent d'être stockés en DZD. Les colonnes `*_eur` ajoutées ici ne
--  servent qu'à mémoriser ce que l'agence a saisi ou facturé en euros.
--
--  Idempotent : peut être rejoué sans risque.
-- ============================================================================

begin;

-- 1. CARS — tarifs en euros (facultatifs) --------------------------------------
--    NULL = tarif euro non défini ⇒ l'application convertit le tarif DZD au
--    taux de change de la réservation. 0 signifierait « gratuit », d'où le NULL.
alter table public.cars
  add column if not exists price_day_eur   numeric,
  add column if not exists price_week_eur  numeric,
  add column if not exists price_month_eur numeric,
  add column if not exists deposit_eur     numeric;

comment on column public.cars.price_day_eur   is 'Tarif jour en euros. NULL ⇒ conversion automatique depuis price_per_day.';
comment on column public.cars.price_week_eur  is 'Tarif semaine en euros. NULL ⇒ conversion automatique depuis price_week.';
comment on column public.cars.price_month_eur is 'Tarif mois en euros. NULL ⇒ conversion automatique depuis price_month.';
comment on column public.cars.deposit_eur     is 'Caution en euros. NULL ⇒ conversion automatique depuis deposit.';

-- Un tarif négatif n'a pas de sens ; NULL reste autorisé.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cars_eur_prices_non_negative'
  ) then
    alter table public.cars
      add constraint cars_eur_prices_non_negative check (
        coalesce(price_day_eur,   0) >= 0 and
        coalesce(price_week_eur,  0) >= 0 and
        coalesce(price_month_eur, 0) >= 0 and
        coalesce(deposit_eur,     0) >= 0
      );
  end if;
end $$;


-- 2. RESERVATIONS — devise de règlement ---------------------------------------
alter table public.reservations
  add column if not exists payment_currency      text    not null default 'DZD',
  add column if not exists total_price_eur       numeric,
  add column if not exists advance_payment_eur   numeric,
  add column if not exists remaining_payment_eur numeric;

comment on column public.reservations.payment_currency      is 'Devise réglée par le client : DZD ou EUR. Les colonnes DZD restent la référence comptable.';
comment on column public.reservations.total_price_eur       is 'Total facturé en euros quand payment_currency = EUR, sinon NULL.';
comment on column public.reservations.advance_payment_eur   is 'Acompte en euros quand payment_currency = EUR, sinon NULL.';
comment on column public.reservations.remaining_payment_eur is 'Reste à payer en euros quand payment_currency = EUR, sinon NULL.';

-- `euro_rate` existe déjà (défaut 145) et sert désormais aussi à convertir le
-- total, pas seulement la caution.
comment on column public.reservations.euro_rate is 'Taux DA/€ appliqué à la réservation (caution ET total).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_payment_currency_check'
  ) then
    alter table public.reservations
      add constraint reservations_payment_currency_check
      check (payment_currency in ('DZD', 'EUR'));
  end if;
end $$;

-- Les réservations déjà enregistrées ont toutes été réglées en dinars.
update public.reservations
   set payment_currency = 'DZD'
 where payment_currency is null;

commit;


-- ============================================================================
--  OPTIONNEL — Assurance « Serenity »
--  ---------------------------------------------------------------------------
--  L'éditeur a été retiré de l'étape de paiement, mais les colonnes sont
--  CONSERVÉES : les réservations existantes les affichent encore (fiche détail,
--  contrats imprimés). Ne jouez ce bloc que si vous acceptez de perdre ces
--  données de façon définitive.
-- ============================================================================
-- alter table public.reservations
--   drop column if exists assurance_enabled,
--   drop column if exists assurance_percentage;
