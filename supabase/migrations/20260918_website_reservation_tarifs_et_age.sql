-- ============================================================================
--  Réservations du site public : forfaits, fiche client complète et âge minimum
--  ---------------------------------------------------------------------------
--  Trois manques corrigés ici, tous côté `create_website_reservation` :
--
--  1. TARIFS — le wizard envoie déjà price_per_day / price_week / price_month /
--     deposit / discount_amount / discount_type / notes, mais la fonction les
--     jetait. L'agence recevait donc une commande sans savoir quels forfaits
--     avaient été appliqués (7 j au tarif semaine, 30 j au tarif mois…).
--
--  2. FICHE CLIENT — seuls 9 champs sur 20 étaient enregistrés. La date de
--     naissance, le lieu de naissance, les dates du permis et le document
--     additionnel étaient perdus, alors que le formulaire les collecte.
--
--  3. ÂGE MINIMUM — la location est interdite aux moins de 18 ans. Le wizard
--     bloque déjà la confirmation, mais la RPC est appelable directement par le
--     rôle `anon` : la règle doit donc aussi être tenue côté serveur.
--
--  Idempotent : peut être rejoué sans risque.
-- ============================================================================

begin;

-- ── 1. Colonnes utilisées ci-dessous (rappels idempotents) ───────────────────
alter table public.reservations
  add column if not exists price_week      numeric,
  add column if not exists price_month     numeric,
  add column if not exists discount_amount numeric default 0,
  add column if not exists discount_type   text;


-- ── 2. RPC complète ─────────────────────────────────────────────────────────
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
  v_dob       date    := nullif(p_client->>'date_of_birth','')::date;
begin
  -- Âge minimum légal : la date de naissance est obligatoire et le conducteur
  -- doit avoir 18 ans révolus au premier jour de la location.
  if v_dob is null then
    raise exception 'CLIENT_BIRTHDATE_REQUIRED';
  end if;
  if age(v_from, v_dob) < interval '18 years' then
    raise exception 'CLIENT_UNDERAGE';
  end if;

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

  -- Client — fiche complète. Les informations sont facultatives côté site
  -- (le client les complète à l'agence) : `nullif(...,'')` évite d'écrire des
  -- chaînes vides dans des colonnes date.
  insert into public.clients (
    first_name, last_name, phone, email,
    date_of_birth, place_of_birth, id_card_number,
    license_number, license_expiration_date, license_delivery_date, license_delivery_place,
    document_type, document_number, document_delivery_date, document_expiration_date,
    document_delivery_address,
    wilaya, complete_address, profile_photo, scanned_documents
  ) values (
    coalesce(p_client->>'first_name',''), coalesce(p_client->>'last_name',''),
    nullif(p_client->>'phone',''), nullif(p_client->>'email',''),
    v_dob,
    nullif(p_client->>'place_of_birth',''),
    nullif(p_client->>'id_card_number',''),
    nullif(p_client->>'license_number',''),
    nullif(p_client->>'license_expiration_date','')::date,
    nullif(p_client->>'license_delivery_date','')::date,
    nullif(p_client->>'license_delivery_place',''),
    nullif(p_client->>'document_type',''),
    nullif(p_client->>'document_number',''),
    nullif(p_client->>'document_delivery_date','')::date,
    nullif(p_client->>'document_expiration_date','')::date,
    nullif(p_client->>'document_delivery_address',''),
    nullif(p_client->>'wilaya',''),
    nullif(p_client->>'complete_address',''),
    nullif(p_client->>'profile_photo',''),
    coalesce(p_client->'scanned_documents', '[]'::jsonb)
  )
  returning id into v_client_id;

  -- Réservation : toujours issue du site public → statut 'website_reservation'.
  -- Les tarifs unitaires sont mémorisés : sans eux, l'agence ne peut pas
  -- retrouver la ventilation mois / semaines / jours du total affiché au client.
  insert into public.reservations (
    client_id, car_id, departure_date, departure_time, departure_agency_id,
    return_date, return_time, return_agency_id,
    price_per_day, price_week, price_month,
    total_days, total_price, deposit,
    discount_amount, discount_type, notes,
    additional_fees, protection_assurance_id, protection_assurance_name,
    protection_assurance_price, status, source,
    payment_currency, total_price_eur, euro_rate
  ) values (
    v_client_id, v_car_id,
    v_from, p_reservation->>'departure_time', (p_reservation->>'departure_agency_id')::uuid,
    v_to, p_reservation->>'return_time', (p_reservation->>'return_agency_id')::uuid,
    coalesce(nullif(p_reservation->>'price_per_day','')::numeric, 0),
    nullif(p_reservation->>'price_week','')::numeric,
    nullif(p_reservation->>'price_month','')::numeric,
    coalesce((p_reservation->>'total_days')::int, 0),
    coalesce((p_reservation->>'total_price')::numeric, 0),
    coalesce(nullif(p_reservation->>'deposit','')::numeric, 0),
    coalesce(nullif(p_reservation->>'discount_amount','')::numeric, 0),
    nullif(p_reservation->>'discount_type',''),
    nullif(p_reservation->>'notes',''),
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

-- PostgREST met le schéma en cache : sans ce signal, la fonction remplacée
-- ci-dessus reste servie dans son ancienne version.
notify pgrst, 'reload schema';
