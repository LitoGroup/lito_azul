-- ============================================================
-- GESTÃO DE EQUIPE pelo painel — rode UMA vez no SQL Editor.
-- (Requer o papeis-setup.sql rodado antes.)
--
-- Abre a allowlist "adminsLAZ" na API SOMENTE para admins:
-- admin vê a equipe, muda papéis (admin/azul/lito), adiciona
-- e remove membros direto pelo painel, sem SQL.
-- ============================================================

-- 1) Políticas: só admin enxerga/gerencia a equipe -------------
drop policy if exists "admin le equipe" on "adminsLAZ";
create policy "admin le equipe"
  on "adminsLAZ" for select
  to authenticated
  using (public.eh_admin_laz());

drop policy if exists "admin adiciona membro" on "adminsLAZ";
create policy "admin adiciona membro"
  on "adminsLAZ" for insert
  to authenticated
  with check (public.eh_admin_laz());

drop policy if exists "admin muda papel" on "adminsLAZ";
create policy "admin muda papel"
  on "adminsLAZ" for update
  to authenticated
  using (public.eh_admin_laz())
  with check (public.eh_admin_laz());

drop policy if exists "admin remove membro" on "adminsLAZ";
create policy "admin remove membro"
  on "adminsLAZ" for delete
  to authenticated
  using (public.eh_admin_laz());

-- 2) Papéis válidos -------------------------------------------
alter table "adminsLAZ" drop constraint if exists "adminsLAZ_papel_chk";
alter table "adminsLAZ" add constraint "adminsLAZ_papel_chk"
  check (papel in ('admin', 'azul', 'lito'));

-- 3) Trava de segurança: nunca ficar sem admin -----------------
-- Impede remover ou rebaixar o último admin (senão ninguém
-- gerencia mais a equipe).
create or replace function public.protege_admin_laz()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from "adminsLAZ" where papel = 'admin') then
    raise exception 'Operação bloqueada: o painel precisa de pelo menos um admin.';
  end if;
  return null;
end;
$$;

drop trigger if exists protege_admin_laz_trg on "adminsLAZ";
create constraint trigger protege_admin_laz_trg
  after update or delete on "adminsLAZ"
  for each row
  execute function public.protege_admin_laz();
