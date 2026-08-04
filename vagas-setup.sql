-- ============================================================
-- Área de VAGAS do painel (tabela vagasLAZ)
-- Rode UMA vez no SQL Editor.
--
-- Segurança: nenhuma política para "anon" → a tabela é
-- invisível para o público/alunos. Só admins da allowlist
-- (adminsLAZ) leem, publicam e editam.
-- ============================================================

create table if not exists "vagasLAZ" (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  titulo         text not null,
  local          text,           -- base/cidade (ex.: VCP — Campinas)
  link           text,           -- URL da vaga na Gupy
  descricao      text,           -- requisitos/observações
  status         text not null default 'aberta',   -- aberta | encerrada
  publicado_por  text            -- e-mail de quem publicou
);

create index if not exists "vagasLAZ_criado_em_idx"
  on "vagasLAZ" (criado_em desc);

alter table "vagasLAZ" enable row level security;

drop policy if exists "admin le vagas" on "vagasLAZ";
create policy "admin le vagas"
  on "vagasLAZ" for select
  to authenticated
  using (public.is_admin_laz());

drop policy if exists "admin publica vaga" on "vagasLAZ";
create policy "admin publica vaga"
  on "vagasLAZ" for insert
  to authenticated
  with check (public.is_admin_laz());

drop policy if exists "admin atualiza vaga" on "vagasLAZ";
create policy "admin atualiza vaga"
  on "vagasLAZ" for update
  to authenticated
  using (public.is_admin_laz())
  with check (public.is_admin_laz());

-- Tempo real: vagas novas aparecem sem recarregar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vagasLAZ'
  ) then
    execute 'alter publication supabase_realtime add table "vagasLAZ"';
  end if;
end $$;
