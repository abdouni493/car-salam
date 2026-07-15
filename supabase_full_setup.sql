-- ============================================================================
--  AUTO LOCATION SALAM — FULL SUPABASE SETUP
-- ============================================================================
--  Run this whole file ONCE in the Supabase SQL Editor of the project:
--      https://xpnqyimmfxllquaccuoa.supabase.co
--
--  It creates EVERYTHING the application needs:
--    • All tables used by every interface (cars, clients, agencies, workers,
--      reservations, payments, inspections, expenses, offers, website, …)
--    • The `admin_count` view read by the login page
--    • Triggers that keep Supabase Authentication aligned with the app:
--        - Admin accounts created from the LOGIN page (auth.users -> profiles)
--        - Worker accounts created from the TEAM (Équipe) interface
--          (workers -> auth.users, each aligned by email + password)
--    • All RPC functions the app calls (worker login, reservations, promo
--      codes, availability, sessions, …)
--    • The storage buckets used for every image upload, each returning a
--      public URL that is stored on the row and displayed back from that URL.
--    • Row Level Security enabled with working policies.
--
--  Safe to re-run: it uses IF NOT EXISTS / CREATE OR REPLACE / idempotent
--  policy drops wherever possible.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid(), crypt(), gen_salt()
create extension if not exists "uuid-ossp";


-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- 1.1 PROFILES ----------------------------------------------------------------
-- One row per admin/user account. Linked 1:1 to auth.users(id).
-- Populated automatically when an admin account is created on the LOGIN page.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  username    text,
  email       text,
  role        text not null default 'admin',
  created_at  timestamptz not null default now()
);

-- 1.2 AGENCIES ----------------------------------------------------------------
create table if not exists public.agencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  city        text,
  created_at  timestamptz not null default now()
);

-- 1.3 CARS --------------------------------------------------------------------
create table if not exists public.cars (
  id                  uuid primary key default gen_random_uuid(),
  brand               text not null,
  model               text not null,
  plate_number        text,
  year                int,
  color               text default 'Premium',
  vin                 text,
  energy              text default 'Essence',
  transmission        text default 'Automatique',
  seats               int default 5,
  doors               int default 4,
  price_per_day       numeric not null default 0,
  price_week          numeric,
  price_month         numeric,
  deposit             numeric,
  image_url           text,                       -- public URL from the "cars" bucket
  mileage             int default 0,
  fuel_level          text,
  status              text default 'disponible',  -- only 'maintenance' is set manually
  is_hidden_from_site boolean not null default false,
  created_at          timestamptz not null default now()
);

-- 1.4 CLIENTS -----------------------------------------------------------------
create table if not exists public.clients (
  id                        uuid primary key default gen_random_uuid(),
  first_name                text not null,
  last_name                 text not null,
  phone                     text,
  email                     text,
  date_of_birth             date,
  place_of_birth            text,
  id_card_number            text,
  license_number            text,
  license_expiration_date   date,
  license_delivery_date     date,
  license_delivery_place    text,
  document_type             text,
  document_number           text,
  document_delivery_date    date,
  document_expiration_date  date,
  document_delivery_address text,
  wilaya                    text,
  complete_address          text,
  profile_photo             text,                 -- public URL from the "clients" bucket
  scanned_documents         jsonb default '[]'::jsonb,  -- array of public URLs ("clients" bucket)
  agency_id                 uuid references public.agencies(id) on delete set null,
  created_at                timestamptz not null default now()
);

-- ============================================================================
-- 2. TEAM (ÉQUIPE) — WORKERS AND THEIR RECORDS
-- ============================================================================

-- 2.1 WORKERS -----------------------------------------------------------------
-- Created from the Team (Équipe) interface. Each worker also gets a matching
-- Supabase Authentication account (see trigger in section 5) aligned by
-- email + password.
create table if not exists public.workers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  date_of_birth date,
  phone         text,
  email         text unique,
  address       text,
  profile_photo text,                             -- public URL from the "worker" bucket
  type          text not null default 'worker',   -- 'admin' | 'worker' | 'driver'
  payment_type  text,                             -- 'daily' | 'monthly'
  base_salary   numeric default 0,
  username      text,
  password      text,                             -- used by login_worker() RPC
  created_at    timestamptz not null default now()
);

-- 2.2 WORKER ADVANCES ---------------------------------------------------------
create table if not exists public.worker_advances (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.workers(id) on delete cascade,
  amount     numeric not null default 0,
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

-- 2.3 WORKER ABSENCES ---------------------------------------------------------
create table if not exists public.worker_absences (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.workers(id) on delete cascade,
  cost       numeric not null default 0,
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

-- 2.4 WORKER PAYMENTS ---------------------------------------------------------
create table if not exists public.worker_payments (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.workers(id) on delete cascade,
  amount      numeric not null default 0,
  date        date not null default current_date,
  base_salary numeric default 0,
  advances    numeric default 0,
  absences    numeric default 0,
  net_salary  numeric default 0,
  note        text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 3. EXPENSES, MAINTENANCE, SERVICES, ASSURANCES
-- ============================================================================

-- 3.1 STORE EXPENSES ----------------------------------------------------------
create table if not exists public.store_expenses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  cost       numeric not null default 0,
  date       date not null default current_date,
  note       text,
  icon       text,
  created_at timestamptz not null default now()
);

-- 3.2 VEHICLE EXPENSES --------------------------------------------------------
create table if not exists public.vehicle_expenses (
  id              uuid primary key default gen_random_uuid(),
  car_id          uuid references public.cars(id) on delete cascade,
  type            text,                       -- vidange | assurance | controle | chaine | autre
  cost            numeric not null default 0,
  date            date not null default current_date,
  note            text,
  current_mileage int,
  next_vidange_km int,
  expiration_date date,
  expense_name    text,
  oil_filter_changed  boolean not null default false,   -- vidange : filtre à huile changé
  air_filter_changed  boolean not null default false,   -- vidange : filtre à air changé
  fuel_filter_changed boolean not null default false,   -- vidange : filtre à carburant changé
  ac_filter_changed   boolean not null default false,   -- vidange : filtre de climatisation changé
  created_at      timestamptz not null default now()
);

-- 3.3 MAINTENANCE ALERTS ------------------------------------------------------
create table if not exists public.maintenance_alerts (
  id                   uuid primary key default gen_random_uuid(),
  car_id               uuid references public.cars(id) on delete cascade,
  car_info             text,
  type                 text,                  -- vidange | assurance | controle | chaine | other
  title                text,
  message              text,
  severity             text default 'medium', -- low | medium | high | critical
  due_date             date,
  is_expired           boolean default false,
  days_until_due       int,
  current_mileage      int,
  next_service_mileage int,
  created_at           timestamptz not null default now()
);

-- 3.4 SERVICES (additional paid services offered on reservations) -------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  category     text,
  service_name text not null,
  description  text,
  price        numeric not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 3.5 PROTECTION ASSURANCES (insurance packages) -----------------------------
create table if not exists public.protection_assurances (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  price_per_day numeric not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.protection_assurance_items (
  id            uuid primary key default gen_random_uuid(),
  item_name     text not null,
  display_order int default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.protection_assurance_item_links (
  id           uuid primary key default gen_random_uuid(),
  assurance_id uuid not null references public.protection_assurances(id) on delete cascade,
  item_id      uuid not null references public.protection_assurance_items(id) on delete cascade,
  status       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 4. RESERVATIONS, PAYMENTS, INSPECTIONS
-- ============================================================================

-- 4.1 RESERVATIONS ------------------------------------------------------------
-- Named FK constraints below are REQUIRED so PostgREST embeds like
-- agencies!reservations_departure_agency_fkey work from the app.
create table if not exists public.reservations (
  id                          uuid primary key default gen_random_uuid(),
  client_id                   uuid references public.clients(id) on delete set null,
  car_id                      uuid references public.cars(id) on delete set null,

  departure_date              date,
  departure_time              text,
  departure_agency_id         uuid,
  return_date                 date,
  return_time                 text,
  return_agency_id            uuid,

  price_per_day               numeric default 0,
  price_week                  numeric,
  price_month                 numeric,
  total_days                  int default 0,
  total_price                 numeric default 0,
  deposit                     numeric default 0,
  additional_fees             numeric default 0,
  discount_amount             numeric default 0,
  discount_type               text,
  advance_payment             numeric default 0,
  remaining_payment           numeric default 0,

  caution_amount_dzd          numeric,
  caution_currency            text default 'DZD',
  euro_rate                   numeric default 145,

  assurance_enabled           boolean default false,
  assurance_percentage        numeric,
  protection_assurance_id     uuid,
  protection_assurance_name   text,
  protection_assurance_price  numeric default 0,

  tva_applied                 boolean default false,
  excess_mileage              numeric,
  missing_fuel                numeric,
  notes                       text,
  conditions                  text,

  -- 'website' = order placed from the public site, 'agency' = created by admin
  source                      text default 'agency',
  status                      text not null default 'pending',

  created_by                  text,
  created_by_name             text,
  created_at                  timestamptz not null default now(),
  activated_at                timestamptz,
  completed_at                timestamptz,

  constraint reservations_departure_agency_fkey
    foreign key (departure_agency_id) references public.agencies(id) on delete set null,
  constraint reservations_return_agency_fkey
    foreign key (return_agency_id) references public.agencies(id) on delete set null,
  constraint reservations_protection_assurance_fkey
    foreign key (protection_assurance_id) references public.protection_assurances(id) on delete set null
);

create index if not exists idx_reservations_car    on public.reservations(car_id);
create index if not exists idx_reservations_client on public.reservations(client_id);
create index if not exists idx_reservations_status on public.reservations(status);

-- 4.2 RESERVATION SERVICES (snapshot of selected extra services) --------------
create table if not exists public.reservation_services (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  category       text,
  service_name   text,
  description    text,
  price          numeric not null default 0,
  created_at     timestamptz not null default now()
);

-- 4.3 PAYMENTS ----------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  amount         numeric not null default 0,
  date           date not null default current_date,
  method         text default 'cash',   -- cash | card | transfer | check
  status         text default 'paid',
  note           text,
  created_at     timestamptz not null default now()
);

-- 4.4 INSPECTION CHECKLIST ITEMS (master list) --------------------------------
create table if not exists public.inspection_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  category      text,                  -- security | equipment | comfort | cleanliness
  item_name     text not null,
  display_order int default 0,
  created_at    timestamptz not null default now()
);

-- 4.5 VEHICLE INSPECTIONS (departure / return) --------------------------------
create table if not exists public.vehicle_inspections (
  id                    uuid primary key default gen_random_uuid(),
  reservation_id        uuid not null references public.reservations(id) on delete cascade,
  type                  text not null,        -- 'departure' | 'return'
  mileage               int,
  fuel_level            text,
  agency_id             uuid references public.agencies(id) on delete set null,
  exterior_front_photo  text,                 -- public URL ("inspection" bucket)
  exterior_rear_photo   text,                 -- public URL ("inspection" bucket)
  interior_photo        text,                 -- public URL ("inspection" bucket)
  other_photos          jsonb default '[]'::jsonb,   -- array of public URLs
  client_signature      text,
  notes                 text,
  date                  date,
  time                  text,
  created_at            timestamptz not null default now(),
  constraint vehicle_inspections_res_type_unique unique (reservation_id, type)
);

-- 4.6 INSPECTION RESPONSES (checklist answers per inspection) -----------------
create table if not exists public.inspection_responses (
  id                uuid primary key default gen_random_uuid(),
  inspection_id     uuid not null references public.vehicle_inspections(id) on delete cascade,
  checklist_item_id uuid references public.inspection_checklist_items(id) on delete cascade,
  status            boolean not null default false,
  note              text,
  created_at        timestamptz not null default now(),
  constraint inspection_responses_unique unique (inspection_id, checklist_item_id)
);

-- ============================================================================
-- 5. WEBSITE / OFFERS / PROMO CODES / DOCUMENT TEMPLATES
-- ============================================================================

-- 5.1 SPECIAL OFFERS (promotions attached to a car) ---------------------------
create table if not exists public.special_offers (
  id             uuid primary key default gen_random_uuid(),
  car_id         uuid references public.cars(id) on delete cascade,
  old_price      numeric,
  new_price      numeric,
  note           text,
  is_active      boolean not null default true,
  label          text,
  discount_type  text,                 -- 'percentage' | 'fixed'
  discount_value numeric,
  start_date     date,
  end_date       date,
  created_at     timestamptz not null default now()
);

-- 5.2 OFFERS (deprecated, kept for backward compatibility) --------------------
create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  car_id     uuid references public.cars(id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5.3 PROMO CODES -------------------------------------------------------------
create table if not exists public.promo_codes (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  discount_percentage numeric not null default 0,
  is_active           boolean not null default true,
  is_used             boolean not null default false,
  used_at             timestamptz,
  reservation_id      uuid references public.reservations(id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint promo_codes_code_unique unique (code)
);

-- 5.4 WEBSITE CONTACTS --------------------------------------------------------
create table if not exists public.website_contacts (
  id         uuid primary key default gen_random_uuid(),
  facebook   text,
  instagram  text,
  tiktok     text,
  whatsapp   text,
  phone      text,
  address    text,
  email      text,
  updated_at timestamptz not null default now()
);

-- 5.5 WEBSITE SETTINGS --------------------------------------------------------
create table if not exists public.website_settings (
  id                 uuid primary key default gen_random_uuid(),
  name               text,
  description        text,
  logo               text,                -- public URL ("website" bucket)
  phone_number_2     text,
  bank_number        text,
  address            text,
  phone              text,
  landing_background text,                -- public URL ("website" bucket)
  updated_at         timestamptz not null default now()
);

-- 5.6 AGENCY SETTINGS (branding + document templates snapshot) ----------------
create table if not exists public.agency_settings (
  id                 uuid primary key default gen_random_uuid(),
  agency_name        text,
  slogan             text,
  address            text,
  phone              text,
  logo               text,
  document_templates jsonb default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 5.7 DOCUMENT TEMPLATES (positioned fields for contracts/invoices/…) ---------
create table if not exists public.document_templates (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid,
  template_type text not null,        -- contrat | devis | facture | recu | engagement
  name          text,
  template      jsonb not null default '{}'::jsonb,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- 6. ADMIN SESSIONS (audit trail for the database-backed session service)
-- ============================================================================
create table if not exists public.admin_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  expires_at    bigint not null,
  user_agent    text,
  ip_address    text,
  is_valid      boolean not null default true,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists idx_admin_sessions_token on public.admin_sessions(access_token);


-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- 7.1 admin_count — read by the LOGIN page to know whether an admin already
--     exists (so the "Create admin account" button can be hidden).
create or replace view public.admin_count as
  select count(*)::int as count
  from public.profiles
  where role = 'admin';


-- ============================================================================
-- 8. AUTH ALIGNMENT TRIGGERS
--    Keep the Supabase Authentication interface in sync with the app so that
--    every admin AND every worker has a login account aligned by email/password.
-- ============================================================================

-- 8.1 auth.users -> profiles
-- When an admin account is created from the LOGIN page (supabase.auth.signUp),
-- ensure a matching profiles row exists (the app also inserts it explicitly;
-- this trigger is a safety net so the two stay aligned).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'admin')
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        username  = coalesce(excluded.username,  public.profiles.username),
        email     = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8.2 workers -> auth.users
-- When a worker is created from the TEAM (Équipe) interface, create a matching
-- Supabase Authentication account so their login information (email + password)
-- appears in the Authentication interface, aligned to that worker.
-- The worker's password (stored on the workers row) is hashed with bcrypt.
-- If auth creation fails on your GoTrue version, the worker is still created and
-- can log in via the login_worker() RPC (below) — the insert is never aborted.
create or replace function public.handle_new_worker()
returns trigger
language plpgsql
security definer set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  -- Don't duplicate an already-existing auth account for this email.
  if exists (select 1 from auth.users where email = new.email) then
    return new;
  end if;

  v_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_uid, 'authenticated', 'authenticated', new.email,
    crypt(coalesce(nullif(new.password, ''), 'ChangeMe123!'), gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', new.full_name,
      'username',  new.username,
      'role',      new.type
    ),
    '', '', '', ''
  );

  -- Identity record required by GoTrue for email/password sign-in.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, new.email,
    jsonb_build_object('sub', v_uid::text, 'email', new.email),
    'email', now(), now(), now()
  );

  return new;
exception when others then
  -- Never block worker creation because of an auth-sync problem.
  raise warning 'handle_new_worker: could not create auth user for %: %', new.email, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_worker_created on public.workers;
create trigger on_worker_created
  after insert on public.workers
  for each row execute function public.handle_new_worker();


-- ============================================================================
-- 9. APPLICATION RPC FUNCTIONS (called by the app via supabase.rpc(...))
-- ============================================================================

-- 9.1 login_worker(email_or_username, password)
-- Worker sign-in from the LOGIN page (fallback after Supabase Auth). Returns a
-- JSON object { success, worker } or { success:false, error }.
create or replace function public.login_worker(
  p_email_or_username text,
  p_password          text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  w public.workers%rowtype;
begin
  select * into w
  from public.workers
  where (lower(email) = lower(p_email_or_username)
         or lower(username) = lower(p_email_or_username))
    and password = p_password
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'invalid_credentials');
  end if;

  return jsonb_build_object(
    'success', true,
    'worker', jsonb_build_object(
      'id', w.id,
      'full_name', w.full_name,
      'email', w.email,
      'username', w.username,
      'type', w.type,
      'profile_photo', w.profile_photo
    )
  );
end;
$$;

-- 9.2 get_reserved_periods(car_id)
-- Reserved date ranges for a car, used by the public calendar to block dates.
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

-- 9.3 get_unavailable_car_ids(from, to)
-- IDs of cars unavailable for an overlapping period.
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

-- 9.4 verify_promo_code(code)
-- Validate a promo code server-side (anon-safe). Returns { valid, discount_percentage, reason }.
create or replace function public.verify_promo_code(p_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  pc public.promo_codes%rowtype;
begin
  select * into pc
  from public.promo_codes
  where upper(code) = upper(btrim(p_code))
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not pc.is_active then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if pc.is_used then
    return jsonb_build_object('valid', false, 'reason', 'already_used');
  end if;

  return jsonb_build_object('valid', true, 'discount_percentage', pc.discount_percentage);
end;
$$;

-- 9.5 create_website_reservation(client, reservation, services, promo_code)
-- Single-transaction write path for the PUBLIC website (anon role has no direct
-- INSERT rights on clients/reservations). Creates client + reservation +
-- services, consumes the promo code, and guards against double-booking.
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
  -- Availability guard (overlapping active-ish reservations, y compris les
  -- commandes du site encore en attente d'acceptation 'website_reservation')
  if exists (
    select 1 from public.reservations
    where car_id = v_car_id
      and status in ('website_reservation','pending','accepted','confirmed','active')
      and departure_date <= v_to
      and return_date   >= v_from
  ) then
    raise exception 'CAR_UNAVAILABLE';
  end if;

  -- Optional promo code
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

  -- Reservation (always from the public website)
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
    -- Statut dédié : la commande attend l'acceptation de l'agence dans
    -- « Website commandes » avant de rejoindre le planificateur ('pending').
    'website_reservation', 'website'
  )
  returning id into v_res_id;

  -- Extra services
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

  -- Consume promo code
  if v_pc.id is not null then
    update public.promo_codes
       set is_used = true, used_at = now(), reservation_id = v_res_id
     where id = v_pc.id;
  end if;

  return jsonb_build_object('reservation_id', v_res_id, 'client_id', v_client_id);
end;
$$;

-- 9.6 Database-backed session helpers (audit trail; localStorage is primary)
create or replace function public.create_admin_session(
  p_access_token  text,
  p_refresh_token text,
  p_expires_at    bigint,
  p_user_agent    text,
  p_ip_address    text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_sessions (user_id, access_token, refresh_token, expires_at, user_agent, ip_address)
  values (auth.uid(), p_access_token, p_refresh_token, p_expires_at, p_user_agent, p_ip_address)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.validate_session(p_token text)
returns table (is_valid boolean, is_expired boolean, seconds_until_expiry bigint)
language sql
security definer set search_path = public
as $$
  select
    s.is_valid,
    (s.expires_at <= extract(epoch from now())::bigint) as is_expired,
    (s.expires_at - extract(epoch from now())::bigint)  as seconds_until_expiry
  from public.admin_sessions s
  where s.access_token = p_token
  order by s.created_at desc
  limit 1;
$$;

create or replace function public.invalidate_session(p_token text)
returns void
language sql
security definer set search_path = public
as $$
  update public.admin_sessions set is_valid = false where access_token = p_token;
$$;


-- ============================================================================
-- 10. STORAGE BUCKETS (one per image-upload feature in the app)
--     Every uploaded image is stored in its bucket; its public URL is saved on
--     the matching table row and the app displays the image from that URL.
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('cars',       'cars',       true),   -- car photos            -> cars.image_url
  ('clients',    'clients',    true),   -- client photos & docs  -> clients.profile_photo / scanned_documents
  ('worker',     'worker',     true),   -- worker profile photos -> workers.profile_photo (uploadWorkerImage)
  ('workers',    'workers',    true),   -- worker profile photos -> workers.profile_photo (ConfigPage)
  ('inspection', 'inspection', true),   -- inspection photos     -> vehicle_inspections.*_photo
  ('website',    'website',    true)    -- logo & landing bg     -> website_settings.logo / landing_background
on conflict (id) do update set public = excluded.public;

-- Storage policies: public read for everyone; write/update/delete for anyone
-- with a valid key (anon + authenticated) so uploads work from every interface.
do $$
declare
  b text;
begin
  foreach b in array array['cars','clients','worker','workers','inspection','website']
  loop
    execute format('drop policy if exists "%s_read"   on storage.objects;', b);
    execute format('drop policy if exists "%s_write"  on storage.objects;', b);
    execute format('drop policy if exists "%s_update" on storage.objects;', b);
    execute format('drop policy if exists "%s_delete" on storage.objects;', b);

    execute format($p$create policy "%1$s_read"   on storage.objects for select using (bucket_id = '%1$s');$p$, b);
    execute format($p$create policy "%1$s_write"  on storage.objects for insert with check (bucket_id = '%1$s');$p$, b);
    execute format($p$create policy "%1$s_update" on storage.objects for update using (bucket_id = '%1$s') with check (bucket_id = '%1$s');$p$, b);
    execute format($p$create policy "%1$s_delete" on storage.objects for delete using (bucket_id = '%1$s');$p$, b);
  end loop;
end $$;


-- ============================================================================
-- 11. ROW LEVEL SECURITY
--     Enable RLS on every table and add working policies:
--       • public/anon can READ what the public website needs (cars, offers,
--         website settings/contacts, services, assurances, agencies).
--       • authenticated users (admins/workers) get full access everywhere.
--     Write paths for the public site go through SECURITY DEFINER RPCs above.
-- ============================================================================

-- 11.1 Enable RLS on all app tables
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','agencies','cars','clients','workers','worker_advances',
    'worker_absences','worker_payments','store_expenses','vehicle_expenses',
    'maintenance_alerts','services','protection_assurances',
    'protection_assurance_items','protection_assurance_item_links',
    'reservations','reservation_services','payments',
    'inspection_checklist_items','vehicle_inspections','inspection_responses',
    'special_offers','offers','promo_codes','website_contacts',
    'website_settings','agency_settings','document_templates','admin_sessions'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- 11.2 Full access for authenticated users (admins + workers logged in via Supabase Auth)
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','agencies','cars','clients','workers','worker_advances',
    'worker_absences','worker_payments','store_expenses','vehicle_expenses',
    'maintenance_alerts','services','protection_assurances',
    'protection_assurance_items','protection_assurance_item_links',
    'reservations','reservation_services','payments',
    'inspection_checklist_items','vehicle_inspections','inspection_responses',
    'special_offers','offers','promo_codes','website_contacts',
    'website_settings','agency_settings','document_templates','admin_sessions'
  ]
  loop
    execute format('drop policy if exists "%1$s_authenticated_all" on public.%1$I;', t);
    execute format(
      'create policy "%1$s_authenticated_all" on public.%1$I for all to authenticated using (true) with check (true);',
      t);
  end loop;
end $$;

-- 11.3 Public (anon) READ access for the tables the public website reads
do $$
declare t text;
begin
  foreach t in array array[
    'cars','agencies','services','special_offers','offers',
    'protection_assurances','protection_assurance_items',
    'protection_assurance_item_links','website_contacts','website_settings'
  ]
  loop
    execute format('drop policy if exists "%1$s_public_read" on public.%1$I;', t);
    execute format(
      'create policy "%1$s_public_read" on public.%1$I for select to anon using (true);',
      t);
  end loop;
end $$;

-- 11.4 Login page needs to read admin_count / profiles anonymously (to decide
--      whether the "Create admin account" button is shown) and to insert the
--      first admin's profile row during signup.
drop policy if exists "profiles_public_read"   on public.profiles;
drop policy if exists "profiles_signup_insert"  on public.profiles;
create policy "profiles_public_read"  on public.profiles for select to anon, authenticated using (true);
create policy "profiles_signup_insert" on public.profiles for insert to anon, authenticated with check (true);

-- The admin_count view runs with the querying role; allow anon to read it.
grant select on public.admin_count to anon, authenticated;

-- 11.5 Allow the public website to READ reservations dates (calendar) — needed
--      by getReservedDateRangesForCar fallback when the RPC is absent.
drop policy if exists "reservations_public_read" on public.reservations;
create policy "reservations_public_read" on public.reservations for select to anon using (true);


-- ============================================================================
-- 12. GRANTS FOR RPC FUNCTIONS (callable by anon + authenticated)
-- ============================================================================
grant execute on function public.login_worker(text, text)                         to anon, authenticated;
grant execute on function public.get_reserved_periods(uuid)                        to anon, authenticated;
grant execute on function public.get_unavailable_car_ids(date, date)               to anon, authenticated;
grant execute on function public.verify_promo_code(text)                           to anon, authenticated;
grant execute on function public.create_website_reservation(jsonb, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.create_admin_session(text, text, bigint, text, text)  to authenticated;
grant execute on function public.validate_session(text)                            to anon, authenticated;
grant execute on function public.invalidate_session(text)                          to anon, authenticated;

-- ============================================================================
--  DONE.
--  Next steps in the Supabase dashboard:
--    1. Authentication > Providers > Email: keep "Enable Email provider" ON.
--       (Optional) turn OFF "Confirm email" so the first admin can sign in
--       immediately after creating the account from the login page.
--    2. Create your first admin from the app's login page ("Créer un compte
--       administrateur"). It will appear under Authentication > Users, and the
--       button will disappear automatically once the admin exists.
--    3. Add workers from the Team (Équipe) interface — each one is mirrored to
--       Authentication > Users, aligned by email + password.
-- ============================================================================
