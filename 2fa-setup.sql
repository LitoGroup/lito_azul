-- ============================================================
-- 2FA (TOTP) — rode UMA vez no SQL Editor.
--
-- Imposição no banco: se o usuário TEM um 2º fator verificado,
-- as permissões do painel só valem em sessão AAL2 (senha + código).
-- Senha roubada sem o app autenticador = painel vazio.
-- Quem ainda não ativou o 2FA continua entrando normalmente.
-- ============================================================

-- Sessão satisfaz o nível exigido para este usuário?
--   • tem fator verificado  → exige aal2
--   • não tem               → aal1 basta
create or replace function public.aal_ok_laz()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'aal') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    ),
    false
  );
$$;

-- Recria as funções-porteiro exigindo o nível certo.
-- (pode_editar_laz e eh_admin_laz derivam de papel_laz,
--  então TODAS as políticas passam a exigir 2FA junto.)
create or replace function public.papel_laz()
returns text
language sql stable security definer set search_path = public
as $$
  select a.papel from "adminsLAZ" a
  where a.email = (auth.jwt() ->> 'email')
    and public.aal_ok_laz();
$$;

create or replace function public.is_admin_laz()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from "adminsLAZ" a
    where a.email = (auth.jwt() ->> 'email')
  ) and public.aal_ok_laz();
$$;
