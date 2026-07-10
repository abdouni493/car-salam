-- ============================================================================
-- 20260710_reservation_services_driver_and_agency_branding.sql
-- ----------------------------------------------------------------------------
-- 1) `reservation_services` : colonnes `driver_id` et `driver_caution`.
--    Le formulaire de réservation permet d'attacher un chauffeur à un service
--    et d'encaisser une caution, mais les colonnes n'existaient pas :
--      « Could not find the 'driver_caution' column of 'reservation_services'
--        in the schema cache »
--
-- 2) `website_settings` : la table est la SOURCE UNIQUE du nom et du logo de
--    l'agence (barre latérale, contrats, factures, devis, reçus, rapports…).
--    `updateWebsiteSettings()` faisait « delete all + insert » : deux appels
--    concurrents pouvaient dupliquer la ligne, et un insert en échec après le
--    delete effaçait tout. Résultat en base : 3 lignes, toutes vides.
--    On fusionne les lignes en UNE ligne, et un index unique interdit
--    définitivement les doublons. Le code écrit désormais par upsert.
--    Le branding déjà effacé est repêché depuis `agency_settings`, que le
--    « delete all » n'a jamais touché (cf. 2).
--
-- 3) `agency_settings` : lue par les documents (BillingPage, éditeur de
--    modèles) mais JAMAIS écrite -> nom et logo vides sur ces impressions.
--    Elle devient un miroir en lecture seule de `website_settings`
--    (trigger de synchronisation). Sa colonne `document_templates` reste sa
--    donnée propre.
--
-- Exécuter UNE FOIS dans le SQL Editor de Supabase. Idempotent : ré-exécutable.
-- ============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 0) LEVÉE DU VERROU D'`id` POSÉ PAR LA PREMIÈRE VERSION DE CETTE MIGRATION
--    `check (id = <uuid fixe>)` rejetait l'insert d'un onglet resté sur
--    l'ancien bundle (« delete all + insert » avec un id aléatoire) :
--      « new row for relation "website_settings" violates check constraint
--        "website_settings_singleton" »
--    Le delete passait, l'insert échouait -> table vide. On lève la contrainte
--    AVANT toute écriture, pour que les blocs suivants réinsèrent librement.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.website_settings drop constraint if exists website_settings_singleton;
alter table public.agency_settings  drop constraint if exists agency_settings_singleton;


-- ─────────────────────────────────────────────────────────────────────────
-- 1) CHAUFFEUR ET CAUTION SUR `reservation_services`
--    `driver_id` référence un employé de type 'driver' (cf. DatabaseService
--    .getDrivers()). `on delete set null` : supprimer un chauffeur ne doit pas
--    supprimer la ligne de service d'une réservation déjà facturée.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.reservation_services
  add column if not exists driver_id      uuid references public.workers(id) on delete set null,
  add column if not exists driver_caution numeric not null default 0;

create index if not exists idx_reservation_services_driver
  on public.reservation_services(driver_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 2) `website_settings` -> UNE SEULE LIGNE
--    Fusion colonne par colonne : on garde, pour chaque champ, la valeur non
--    vide la plus récente. Une ligne vide n'écrase donc jamais une vraie valeur.
--
--    Filet de secours : si le « delete all + insert » a vidé la table, le
--    branding survit dans `agency_settings` — le delete ne visait que
--    `website_settings`, et le trigger y avait recopié nom/slogan/logo/adresse.
--    On repêche donc chaque champ manquant depuis ce miroir.
--    (`phone_number_2`, `bank_number` et `landing_background` n'y sont pas
--     recopiés : eux seuls sont réellement perdus et à ressaisir.)
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_merged record;
  v_mirror record;
begin
  -- `(array_agg(col order by updated_at desc) filter (where col non vide))[1]`
  -- = la valeur la plus récemment renseignée pour cette colonne.
  select
    coalesce((array_agg(name               order by updated_at desc) filter (where nullif(btrim(name), '')               is not null))[1], '') as name,
    coalesce((array_agg(description        order by updated_at desc) filter (where nullif(btrim(description), '')        is not null))[1], '') as description,
    coalesce((array_agg(logo               order by updated_at desc) filter (where nullif(btrim(logo), '')               is not null))[1], '') as logo,
    coalesce((array_agg(phone_number_2     order by updated_at desc) filter (where nullif(btrim(phone_number_2), '')     is not null))[1], '') as phone_number_2,
    coalesce((array_agg(bank_number        order by updated_at desc) filter (where nullif(btrim(bank_number), '')        is not null))[1], '') as bank_number,
    coalesce((array_agg(address            order by updated_at desc) filter (where nullif(btrim(address), '')            is not null))[1], '') as address,
    coalesce((array_agg(phone              order by updated_at desc) filter (where nullif(btrim(phone), '')              is not null))[1], '') as phone,
    coalesce((array_agg(landing_background order by updated_at desc) filter (where nullif(btrim(landing_background), '') is not null))[1], '') as landing_background
    into v_merged
    from public.website_settings;

  -- Miroir de secours. Sur une table vide les agrégats renvoient une ligne de
  -- NULL, donc `v_mirror` est toujours défini et chaque champ vaut au pire ''.
  select
    coalesce((array_agg(agency_name order by updated_at desc) filter (where nullif(btrim(agency_name), '') is not null))[1], '') as name,
    coalesce((array_agg(slogan      order by updated_at desc) filter (where nullif(btrim(slogan), '')      is not null))[1], '') as description,
    coalesce((array_agg(logo        order by updated_at desc) filter (where nullif(btrim(logo), '')        is not null))[1], '') as logo,
    coalesce((array_agg(address     order by updated_at desc) filter (where nullif(btrim(address), '')     is not null))[1], '') as address,
    coalesce((array_agg(phone       order by updated_at desc) filter (where nullif(btrim(phone), '')       is not null))[1], '') as phone
    into v_mirror
    from public.agency_settings;

  delete from public.website_settings;

  insert into public.website_settings (
    id, name, description, logo, phone_number_2,
    bank_number, address, phone, landing_background, updated_at
  ) values (
    v_id,
    coalesce(nullif(v_merged.name, ''),        v_mirror.name,        ''),
    coalesce(nullif(v_merged.description, ''), v_mirror.description, ''),
    coalesce(nullif(v_merged.logo, ''),        v_mirror.logo,        ''),
    coalesce(v_merged.phone_number_2, ''),
    coalesce(v_merged.bank_number, ''),
    coalesce(nullif(v_merged.address, ''),     v_mirror.address,     ''),
    coalesce(nullif(v_merged.phone, ''),       v_mirror.phone,       ''),
    coalesce(v_merged.landing_background, ''),
    now()
  );
end $$;

-- 2.1 Récupération du nom/adresse depuis `agencies` si le branding est vide
--     (cas des bases où le « delete all + insert » a effacé les réglages).
--     N'écrase jamais une valeur déjà renseignée.
update public.website_settings ws
   set name    = coalesce(nullif(btrim(ws.name), ''),    a.name),
       address = coalesce(nullif(btrim(ws.address), ''), a.address)
  from (select name, address from public.agencies order by created_at limit 1) a
 where nullif(btrim(ws.name), '') is null;

-- 2.2 Verrou : au plus UNE ligne, pour toujours.
--     `singleton` vaut toujours `true`, et l'index unique sur cette colonne
--     interdit donc une deuxième ligne.
--
--     On ne verrouille PAS `id` sur une valeur fixe : un onglet encore ouvert
--     sur l'ancien bundle fait « delete all + insert » avec un `id` aléatoire.
--     Une contrainte `check (id = …)` rejetterait cet insert APRÈS le delete,
--     laissant la table vide — exactement la perte de données qu'on corrige.
--     Ici l'ancien client réinsère sa ligne, et le nouveau code fait un upsert
--     sur l'`id` réellement présent. (Le `check (id = …)` de la première version
--     a été levé en 0.)
alter table public.website_settings
  add column if not exists singleton boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'website_settings_singleton_true'
  ) then
    alter table public.website_settings
      add constraint website_settings_singleton_true check (singleton);
  end if;
end $$;

create unique index if not exists website_settings_one_row
  on public.website_settings (singleton);


-- ─────────────────────────────────────────────────────────────────────────
-- 3) `agency_settings` -> MIROIR DE `website_settings`
--    Même traitement singleton, puis synchronisation automatique.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_templates jsonb;
begin
  select coalesce((array_agg(document_templates order by updated_at desc)
                   filter (where document_templates is not null
                             and document_templates <> '{}'::jsonb))[1], '{}'::jsonb)
    into v_templates
    from public.agency_settings;

  delete from public.agency_settings;

  insert into public.agency_settings (
    id, agency_name, slogan, address, phone, logo, document_templates, updated_at
  )
  select v_id, ws.name, ws.description, ws.address, ws.phone, ws.logo,
         coalesce(v_templates, '{}'::jsonb), now()
    from public.website_settings ws
   limit 1;
end $$;

alter table public.agency_settings
  add column if not exists singleton boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agency_settings_singleton_true'
  ) then
    alter table public.agency_settings
      add constraint agency_settings_singleton_true check (singleton);
  end if;
end $$;

create unique index if not exists agency_settings_one_row
  on public.agency_settings (singleton);

-- 3.1 Trigger : toute écriture sur `website_settings` recopie le branding dans
--     `agency_settings`. `document_templates` n'est jamais touché.
create or replace function public.sync_agency_settings_branding()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- `agency_settings` ne contient qu'une ligne : un UPDATE sans WHERE la vise.
  -- (Pas de `on conflict (id)` : l'unique ligne peut porter un `id` hérité,
  --  et le conflit surviendrait alors sur l'index d'unicité, pas sur `id`.)
  update public.agency_settings
     set agency_name = new.name,
         slogan      = new.description,
         address     = new.address,
         phone       = new.phone,
         logo        = new.logo,
         updated_at  = now();

  if not found then
    insert into public.agency_settings (
      id, agency_name, slogan, address, phone, logo, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000001',
      new.name, new.description, new.address, new.phone, new.logo, now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_website_settings_sync_agency on public.website_settings;
create trigger trg_website_settings_sync_agency
  after insert or update on public.website_settings
  for each row execute function public.sync_agency_settings_branding();

commit;

-- Force PostgREST à relire le schéma : sans cela `driver_caution` reste
-- introuvable dans le « schema cache » jusqu'au prochain redémarrage.
notify pgrst, 'reload schema';

-- ============================================================================
-- Vérifications (optionnel)
--   select column_name from information_schema.columns
--    where table_name = 'reservation_services' and column_name like 'driver%';
--
--   select count(*) from public.website_settings;  -- doit valoir 1
--   select name, logo from public.website_settings;
--   select agency_name, logo from public.agency_settings;  -- identiques
-- ============================================================================
