-- ============================================================================
--  Onglet « Profil & Sécurité » : rendre les modifications enregistrables
--  ---------------------------------------------------------------------------
--  Deux natures de comptes coexistent :
--
--   • ADMIN   — compte Supabase Auth (auth.users + public.profiles).
--               Écrit ses propres champs via l'API Auth et la table `profiles`,
--               une fois sa session SDK restaurée (sessionService.ensureSupabaseSession).
--
--   • EMPLOYÉ — ligne de `public.workers` (mot de passe en clair, RPC login_worker).
--               Sa session applicative n'est PAS une session Supabase Auth : le
--               client reste sur le rôle `anon`, pour qui aucune policy RLS
--               n'autorise ni la lecture ni l'écriture de `workers`. Toute mise à
--               jour doit donc passer par une fonction SECURITY DEFINER qui
--               vérifie elle-même l'identité — exactement comme `login_worker`.
--
--  Idempotent : peut être rejoué sans risque.
-- ============================================================================

begin;

-- 1. PROFILES — photo de profil de l'admin ------------------------------------
--    La table ne stockait que nom/username/email/rôle : la photo n'avait nulle
--    part où aller (elle était écrite dans `workers`, où l'admin n'existe pas).
alter table public.profiles
  add column if not exists profile_photo text;

comment on column public.profiles.profile_photo is 'URL publique de la photo de profil de l''administrateur.';


-- 2. WORKERS — mise à jour du compte par l'employé lui-même ---------------------
--    Le mot de passe actuel est la seule preuve d'identité dont dispose un
--    employé. C'est le même contrat que `login_worker`, qui expose déjà la
--    totalité de la fiche à qui présente le couple e-mail + mot de passe :
--    cette fonction n'élargit donc pas la surface d'attaque.
--
--    Chaque paramètre laissé à NULL (ou vide) conserve la valeur existante, ce
--    qui permet d'appeler la fonction depuis le formulaire Profil comme depuis
--    le formulaire Sécurité.
create or replace function public.update_worker_account(
  p_email            text,
  p_current_password text,
  p_full_name        text default null,
  p_username         text default null,
  p_new_email        text default null,
  p_new_password     text default null,
  p_profile_photo    text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_worker public.workers%rowtype;
  v_email  text := lower(btrim(coalesce(p_new_email, '')));
begin
  select * into v_worker
    from public.workers
   where lower(email) = lower(btrim(p_email))
   limit 1;

  if not found then
    raise exception 'WORKER_NOT_FOUND';
  end if;

  if p_current_password is null
     or v_worker.password is distinct from p_current_password then
    raise exception 'WRONG_PASSWORD';
  end if;

  -- Un e-mail déjà porté par un autre employé casserait `login_worker`
  -- (qui résout un compte par son e-mail).
  if v_email <> '' and v_email <> lower(v_worker.email)
     and exists (select 1 from public.workers where lower(email) = v_email) then
    raise exception 'EMAIL_TAKEN';
  end if;

  update public.workers set
    full_name     = coalesce(nullif(btrim(p_full_name), ''),     full_name),
    username      = coalesce(nullif(btrim(p_username), ''),      username),
    email         = coalesce(nullif(v_email, ''),                email),
    password      = coalesce(nullif(p_new_password, ''),         password),
    profile_photo = coalesce(nullif(btrim(p_profile_photo), ''), profile_photo)
  where id = v_worker.id;

  return jsonb_build_object('success', true, 'id', v_worker.id);
end;
$$;

grant execute on function public.update_worker_account(text, text, text, text, text, text, text)
  to anon, authenticated;


-- 3. WORKERS — lecture de sa propre fiche par l'employé -------------------------
--    Même contrat : e-mail + mot de passe. Ne renvoie jamais le mot de passe.
create or replace function public.get_worker_account(
  p_email            text,
  p_current_password text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_worker public.workers%rowtype;
begin
  select * into v_worker
    from public.workers
   where lower(email) = lower(btrim(p_email))
   limit 1;

  if not found or v_worker.password is distinct from p_current_password then
    return jsonb_build_object('success', false);
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_worker.id,
    'full_name', v_worker.full_name,
    'username', v_worker.username,
    'email', v_worker.email,
    'profile_photo', v_worker.profile_photo
  );
end;
$$;

grant execute on function public.get_worker_account(text, text) to anon, authenticated;

commit;

-- PostgREST met le schéma en cache : sans ce signal, `profiles.profile_photo`
-- reste invisible et l'API répond PGRST204 « Could not find the column ».
notify pgrst, 'reload schema';
