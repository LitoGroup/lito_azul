-- ============================================================
-- Lito Academy x Azul — Setup do banco (sufixo LAZ)
-- Rode este script UMA vez no SQL Editor do Supabase Studio.
--
-- Modelo de segurança:
--   • Formulário público (chave anon): só INSERE candidatura e
--     faz upload do currículo. Não lê nada.
--   • Painel: só e-mails cadastrados na allowlist "adminsLAZ"
--     conseguem LER/ATUALIZAR candidaturas e baixar currículos —
--     mesmo que alguém consiga se autenticar no projeto.
-- ============================================================

-- 0) Allowlist de administradores do painel -------------------
create table if not exists "adminsLAZ" (
  email      text primary key,
  criado_em  timestamptz not null default now()
);
-- RLS ligado e SEM políticas: a tabela fica invisível para a API
-- (anon/authenticated). Só o SQL Editor / service_role a gerencia.
alter table "adminsLAZ" enable row level security;

-- >>> CADASTRE AQUI o(s) e-mail(s) com acesso ao painel <<<
--     (o mesmo e-mail do usuário que você criar no Authentication)
insert into "adminsLAZ" (email) values
  ('troque-por-seu-email@exemplo.com')
on conflict (email) do nothing;

-- Função que diz se o usuário logado é admin.
-- SECURITY DEFINER: lê a allowlist ignorando o RLS dela.
create or replace function public.is_admin_laz()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from "adminsLAZ" a
    where a.email = (auth.jwt() ->> 'email')
  );
$$;

-- 1) Tabela de candidaturas -----------------------------------
create table if not exists "candidaturasLAZ" (
  id                     uuid primary key default gen_random_uuid(),
  criado_em              timestamptz not null default now(),
  nome                   text not null,
  cpf                    text not null,
  email                  text not null,
  cursos                 text not null,
  vaga                   text not null,
  curriculo_path         text,          -- caminho do arquivo no Storage
  curriculo_nome         text,          -- nome original do arquivo
  foto_path              text,          -- foto do candidato (opcional)
  cv_atualizado          text,
  cv_informa_lito        text,
  leu_vaga               text,
  autoriza_compartilhar  text,
  info_verdadeiras       text,
  status                 text not null default 'nova',  -- nova | em_analise | indicada | arquivada
  enviado_em             timestamptz
);

create index if not exists "candidaturasLAZ_criado_em_idx"
  on "candidaturasLAZ" (criado_em desc);

-- Migração: garante a coluna de foto em tabelas já criadas.
alter table "candidaturasLAZ" add column if not exists foto_path text;

-- 2) Row Level Security da tabela -----------------------------
alter table "candidaturasLAZ" enable row level security;

-- Formulário público (chave anon) pode apenas INSERIR.
drop policy if exists "anon insere candidatura" on "candidaturasLAZ";
create policy "anon insere candidatura"
  on "candidaturasLAZ" for insert
  to anon
  with check (true);

-- Só admin da allowlist pode LER.
drop policy if exists "admin le candidaturas" on "candidaturasLAZ";
create policy "admin le candidaturas"
  on "candidaturasLAZ" for select
  to authenticated
  using (public.is_admin_laz());

-- Só admin da allowlist pode ATUALIZAR o status.
drop policy if exists "admin atualiza candidatura" on "candidaturasLAZ";
create policy "admin atualiza candidatura"
  on "candidaturasLAZ" for update
  to authenticated
  using (public.is_admin_laz())
  with check (public.is_admin_laz());

-- 3) Storage: bucket privado para currículos ------------------
insert into storage.buckets (id, name, public)
values ('curriculosLAZ', 'curriculosLAZ', false)
on conflict (id) do nothing;

-- anon pode ENVIAR (upload) para o bucket.
drop policy if exists "anon envia curriculo" on storage.objects;
create policy "anon envia curriculo"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'curriculosLAZ');

-- Só admin da allowlist pode LER/baixar os currículos.
drop policy if exists "admin le curriculo" on storage.objects;
create policy "admin le curriculo"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'curriculosLAZ' and public.is_admin_laz());

-- 4) Tempo real (novos cards aparecem sozinhos no painel) ------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'candidaturasLAZ'
  ) then
    execute 'alter publication supabase_realtime add table "candidaturasLAZ"';
  end if;
end $$;
