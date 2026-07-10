-- ============================================================================
--  Devise de règlement des commandes du site public
--  ---------------------------------------------------------------------------
--  Le client choisit à la dernière étape du wizard s'il règle en dinars ou en
--  euros. `create_website_reservation` doit donc mémoriser ce choix, sinon la
--  commande retombe sur le défaut 'DZD' et l'agence perd l'information.
--
--  Le dinar reste la devise de référence : `total_price` est toujours en DA,
--  `total_price_eur` n'est renseigné que quand le client paie en euros.
--
--  Idempotent : peut être rejoué sans risque.
-- ============================================================================

begin;

-- 1. Colonnes (rappel idempotent de migration_prix_euro_et_devise_paiement.sql,
--    pour que cette migration reste applicable seule).
alter table public.cars
  add column if not exists price_day_eur   numeric,
  add column if not exists price_week_eur  numeric,
  add column if not exists price_month_eur numeric,
  add column if not exists deposit_eur     numeric;

alter table public.reservations
  add column if not exists payment_currency      text    not null default 'DZD',
  add column if not exists total_price_eur       numeric,
  add column if not exists advance_payment_eur   numeric,
  add column if not exists remaining_payment_eur numeric;

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


-- 2. RPC — persiste la devise choisie par le client -----------------------------
create or replace function public.create_website_reservation(
  p_client      jsonb,
  p_reservation jsonb,
  p_services    jsonb default '[]'::jsonb,
  p_promo_code  text  default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_id uuid;
  v_res_id    uuid;
  v_car_id    uuid := (p_reservation->>'car_id')::uuid;
  v_from      date  := (p_reservation->>'departure_date')::date;
  v_to        date  := (p_reservation->>'return_date')::date;
  v_svc       jsonb;
  v_pc        public.promo_codes%rowtype;
  -- Une devise inconnue (payload trafiqué, ancien client) retombe sur le dinar
  -- plutôt que de faire échouer l'insertion sur la contrainte CHECK.
  v_currency  text := case
                        when upper(coalesce(p_reservation->>'payment_currency','DZD')) = 'EUR'
                        then 'EUR' else 'DZD'
                      end;
  v_eur_rate  numeric := nullif(p_reservation->>'euro_rate','')::numeric;
begin
  -- Garde de disponibilité : on inclut 'website_reservation' pour éviter
  -- qu'une même voiture soit réservée deux fois pendant qu'une commande
  -- attend encore l'acceptation de l'agence.
  if exists (
    select 1 from public.reservations
    where car_id = v_car_id
      and status in ('website_reservation','pending','accepted','confirmed','active')
      and departure_date <= v_to
      and return_date   >= v_from
  ) then
    raise exception 'CAR_UNAVAILABLE';
  end if;

  -- Code promo optionnel
  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select * into v_pc from public.promo_codes
      where upper(code) = upper(btrim(p_promo_code)) limit 1;
    if not found or not v_pc.is_active or v_pc.is_used then
      raise exception 'PROMO_CODE_INVALID';
    end if;
  end if;

  -- Client
  insert into public.clients (
    first_name, last_name, phone, email, license_number,
    wilaya, complete_address, profile_photo, scanned_documents
  ) values (
    p_client->>'first_name', p_client->>'last_name', p_client->>'phone',
    p_client->>'email', p_client->>'license_number',
    p_client->>'wilaya', p_client->>'complete_address',
    p_client->>'profile_photo',
    coalesce(p_client->'scanned_documents', '[]'::jsonb)
  )
  returning id into v_client_id;

  -- Réservation : toujours issue du site public → statut 'website_reservation'
  insert into public.reservations (
    client_id, car_id, departure_date, departure_time, departure_agency_id,
    return_date, return_time, return_agency_id, total_days, total_price,
    additional_fees, protection_assurance_id, protection_assurance_name,
    protection_assurance_price, status, source,
    payment_currency, total_price_eur, euro_rate
  ) values (
    v_client_id, v_car_id,
    v_from, p_reservation->>'departure_time', (p_reservation->>'departure_agency_id')::uuid,
    v_to, p_reservation->>'return_time', (p_reservation->>'return_agency_id')::uuid,
    coalesce((p_reservation->>'total_days')::int, 0),
    coalesce((p_reservation->>'total_price')::numeric, 0),
    coalesce((p_reservation->>'additional_fees')::numeric, 0),
    nullif(p_reservation->>'protection_assurance_id','')::uuid,
    p_reservation->>'protection_assurance_name',
    coalesce((p_reservation->>'protection_assurance_price')::numeric, 0),
    'website_reservation', 'website',
    v_currency,
    -- Seul un règlement en euros porte un montant en euros : sinon NULL, pour
    -- que l'interface sache qu'aucun total euro n'a été convenu.
    case when v_currency = 'EUR'
         then nullif(p_reservation->>'total_price_eur','')::numeric
         else null end,
    coalesce(v_eur_rate, 145)
  )
  returning id into v_res_id;

  -- Services supplémentaires
  if p_services is not null then
    for v_svc in select * from jsonb_array_elements(p_services)
    loop
      insert into public.reservation_services (reservation_id, category, service_name, description, price)
      values (
        v_res_id, v_svc->>'category', v_svc->>'service_name',
        v_svc->>'description', coalesce((v_svc->>'price')::numeric, 0)
      );
    end loop;
  end if;

  -- Consommation du code promo
  if v_pc.id is not null then
    update public.promo_codes
       set is_used = true, used_at = now(), reservation_id = v_res_id
     where id = v_pc.id;
  end if;

  return jsonb_build_object('reservation_id', v_res_id, 'client_id', v_client_id);
end;
$$;

grant execute on function public.create_website_reservation(jsonb, jsonb, jsonb, text) to anon, authenticated;

commit;

-- PostgREST met le schéma en cache : sans ce signal, les colonnes ajoutées
-- ci-dessus restent invisibles et l'API répond PGRST204.
notify pgrst, 'reload schema';
