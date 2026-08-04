-- ============================================================
-- HIERARQUIA DE PAPÉIS do painel — rode UMA vez no SQL Editor.
--
--   admin → vê tudo, edita tudo, exclui tudo
--   azul  → publica/edita vagas, vê e move candidatos
--   lito  → só visualiza (vagas e candidatos)
--
-- O papel fica na allowlist "adminsLAZ" (coluna papel) e as
-- permissões são impostas pelo BANCO (RLS) — mesmo que alguém
-- altere o JavaScript, o servidor bloqueia.
-- ============================================================

-- 1) Coluna de papel na allowlist -----------------------------
alter table "adminsLAZ" add column if not exists papel text not null default 'lito';

-- >>> DEFINA OS PAPÉIS AQUI <<<
update "adminsLAZ" set papel = 'admin' where email = 'gabriel@avioesemusicas.com';
-- Exemplos (crie o usuário no Authentication com o mesmo e-mail):
-- insert into "adminsLAZ" (email, papel) values ('rh@voeazul.com.br', 'azul') on conflict (email) do update set papel = excluded.papel;
-- insert into "adminsLAZ" (email, papel) values ('equipe@litoacademy.com.br', 'lito') on conflict (email) do update set papel = excluded.papel;

-- 2) Funções de papel -----------------------------------------
-- Papel do usuário logado (null se não estiver na allowlist).
create or replace function public.papel_laz()
returns text
language sql stable security definer set search_path = public
as $$
  select a.papel from "adminsLAZ" a
  where a.email = (auth.jwt() ->> 'email');
$$;

-- admin ou azul (quem pode editar/mover/publicar).
create or replace function public.pode_editar_laz()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.papel_laz() in ('admin', 'azul'), false);
$$;

-- só admin (quem pode excluir).
create or replace function public.eh_admin_laz()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.papel_laz() = 'admin', false);
$$;

-- 3) Políticas — CANDIDATURAS ---------------------------------
-- (leitura continua: qualquer um da allowlist — is_admin_laz)

-- mover candidato (status): admin + azul
drop policy if exists "admin atualiza candidatura" on "candidaturasLAZ";
drop policy if exists "editor atualiza candidatura" on "candidaturasLAZ";
create policy "editor atualiza candidatura"
  on "candidaturasLAZ" for update
  to authenticated
  using (public.pode_editar_laz())
  with check (public.pode_editar_laz());

-- excluir candidatura: só admin
drop policy if exists "admin exclui candidatura" on "candidaturasLAZ";
create policy "admin exclui candidatura"
  on "candidaturasLAZ" for delete
  to authenticated
  using (public.eh_admin_laz());

-- 4) Políticas — VAGAS ----------------------------------------
-- publicar: admin + azul
drop policy if exists "admin publica vaga" on "vagasLAZ";
drop policy if exists "editor publica vaga" on "vagasLAZ";
create policy "editor publica vaga"
  on "vagasLAZ" for insert
  to authenticated
  with check (public.pode_editar_laz());

-- editar/encerrar: admin + azul
drop policy if exists "admin atualiza vaga" on "vagasLAZ";
drop policy if exists "editor atualiza vaga" on "vagasLAZ";
create policy "editor atualiza vaga"
  on "vagasLAZ" for update
  to authenticated
  using (public.pode_editar_laz())
  with check (public.pode_editar_laz());

-- excluir vaga: só admin
drop policy if exists "admin exclui vaga" on "vagasLAZ";
create policy "admin exclui vaga"
  on "vagasLAZ" for delete
  to authenticated
  using (public.eh_admin_laz());

-- 5) Storage: admin pode excluir arquivos (currículo/foto) ----
drop policy if exists "admin exclui arquivo" on storage.objects;
create policy "admin exclui arquivo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'curriculosLAZ' and public.eh_admin_laz());
