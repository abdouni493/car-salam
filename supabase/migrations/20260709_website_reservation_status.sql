-- ============================================================================
-- 20260709_website_reservation_status.sql
-- ----------------------------------------------------------------------------
-- Sépare clairement les commandes du site public des réservations de l'agence.
--
-- AVANT : une commande du site était créée avec status = 'pending' — le même
--         statut que les réservations de l'agence — ce qui les mélangeait dans
--         le planificateur.
--
-- APRÈS : une commande du site est créée avec le statut dédié
--         'website_reservation'.
--           • Elle n'apparaît QUE dans l'interface « Website commandes ».
--           • L'agence peut l'ACCEPTER  → status devient 'pending'
--             (elle rejoint alors le planificateur pour inspection, avec le
--              badge « 🌐 Site web »).
--           • L'agence peut l'ANNULER   → status devient 'cancelled'
--             (elle reste dans « Website commandes », onglet « Annulées »).
--
-- Exécuter ce script UNE FOIS dans le SQL Editor de Supabase.
-- Il est idempotent (create or replace + UPDATE ciblé) : ré-exécutable sans risque.
-- ============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) CORRECTION DES DONNÉES EXISTANTES
--    Les commandes du site déjà enregistrées en 'pending' (jamais acceptées)
--    passent au nouveau statut d'attente 'website_reservation'.
-- ─────────────────────────────────────────────────────────────────────────
update public.reservations
   set status = 'website_reservation'
 where source = 'website'
   and status = 'pending';

-- (Optionnel) Si vous voulez que les anciennes commandes du site déjà
-- « acceptées » suivent exactement le nouveau flux (statut 'pending' sur le
-- planificateur), décommentez la ligne suivante :
-- update public.reservations set status = 'pending'
--  where source = 'website' and status = 'accepted';


-- ─────────────────────────────────────────────────────────────────────────
-- 2) CRÉATION DES COMMANDES DU SITE AVEC LE NOUVEAU STATUT
--    La fonction appelée par le site public insère désormais
--    status = 'website_reservation' (au lieu de 'pending').
-- ─────────────────────────────────────────────────────────────────────────
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
    protection_assurance_price, status, source
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
    'website_reservation', 'website'
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


-- ─────────────────────────────────────────────────────────────────────────
-- 3) DISPONIBILITÉ CÔTÉ SITE PUBLIC
--    Les commandes 'website_reservation' bloquent aussi les dates de la
--    voiture (sinon deux clients pourraient réserver le même créneau).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_reserved_periods(p_car_id uuid)
returns table (departure_date date, return_date date)
language sql
security definer set search_path = public
as $$
  select departure_date, return_date
  from public.reservations
  where car_id = p_car_id
    and status in ('website_reservation', 'pending', 'accepted', 'confirmed', 'active');
$$;

create or replace function public.get_unavailable_car_ids(p_from date, p_to date)
returns table (id uuid)
language sql
security definer set search_path = public
as $$
  select distinct car_id
  from public.reservations
  where car_id is not null
    and status in ('website_reservation', 'pending', 'accepted', 'confirmed', 'active')
    and departure_date <= p_to
    and return_date   >= p_from;
$$;

grant execute on function public.get_reserved_periods(uuid)      to anon, authenticated;
grant execute on function public.get_unavailable_car_ids(date, date) to anon, authenticated;

commit;

-- ============================================================================
-- Vérification (optionnel) : compter les commandes du site par statut
--   select status, count(*) from public.reservations
--    where source = 'website' group by status order by status;
-- ============================================================================
