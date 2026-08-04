-- ============================================================
-- ENDURECIMENTO DE SEGURANÇA — rode UMA vez no SQL Editor.
-- (Requer os setups anteriores: papeis + equipe + ratelimit.)
--
--   1. Validação no servidor (tamanhos, formatos, listas)
--   2. Editores só mudam o STATUS do candidato (nada mais)
--   3. Autor da vaga vem do login (não dá pra falsificar)
--   4. E-mails da equipe normalizados (minúsculas)
--   5. Trilha de auditoria (quem fez o quê, quando)
-- ============================================================

-- 1) Validação de dados no servidor ---------------------------
-- (o navegador valida, mas quem chama a API direto não passa por lá)

alter table "candidaturasLAZ" drop constraint if exists "candLAZ_nome_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_nome_chk"
  check (char_length(nome) between 3 and 120);

alter table "candidaturasLAZ" drop constraint if exists "candLAZ_email_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_email_chk"
  check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 160);

alter table "candidaturasLAZ" drop constraint if exists "candLAZ_cpf_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_cpf_chk"
  check (cpf ~ '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$');

alter table "candidaturasLAZ" drop constraint if exists "candLAZ_tamanhos_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_tamanhos_chk"
  check (
    char_length(cursos) <= 1000 and
    char_length(vaga) <= 200 and
    char_length(coalesce(curriculo_nome, '')) <= 200 and
    char_length(coalesce(curriculo_path, '')) <= 300 and
    char_length(coalesce(foto_path, '')) <= 300
  );

alter table "candidaturasLAZ" drop constraint if exists "candLAZ_status_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_status_chk"
  check (status in ('nova', 'em_analise', 'indicada', 'arquivada'));

alter table "candidaturasLAZ" drop constraint if exists "candLAZ_simnao_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_simnao_chk"
  check (
    coalesce(cv_atualizado, '')         in ('', 'Sim', 'Não') and
    coalesce(cv_informa_lito, '')       in ('', 'Sim', 'Não') and
    coalesce(leu_vaga, '')              in ('', 'Sim', 'Não') and
    coalesce(autoriza_compartilhar, '') in ('', 'Sim', 'Não') and
    coalesce(info_verdadeiras, '')      in ('', 'Sim', 'Não')
  );

alter table "vagasLAZ" drop constraint if exists "vagasLAZ_valida_chk";
alter table "vagasLAZ" add constraint "vagasLAZ_valida_chk"
  check (
    char_length(titulo) between 2 and 160 and
    char_length(coalesce(local, '')) <= 120 and
    char_length(coalesce(descricao, '')) <= 2000 and
    (link is null or (link ~* '^https?://' and char_length(link) <= 500)) and
    status in ('aberta', 'encerrada')
  );

-- 2) Editores (azul) só podem mudar o STATUS do candidato -----
-- Sem isto, quem tem papel "azul" poderia alterar CPF, nome,
-- e-mail etc. de uma candidatura via API.
create or replace function public.protege_campos_candidatura()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.laz_role_req() = 'authenticated' and not public.eh_admin_laz() then
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'Seu papel só permite mover o candidato (status).';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protege_campos_candidatura_trg on "candidaturasLAZ";
create trigger protege_campos_candidatura_trg
  before update on "candidaturasLAZ"
  for each row execute function public.protege_campos_candidatura();

-- 3) Autor da vaga = e-mail do login (à prova de falsificação) -
create or replace function public.assina_vaga()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.laz_role_req() = 'authenticated' then
    new.publicado_por := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
      new.publicado_por);
  end if;
  return new;
end;
$$;

drop trigger if exists assina_vaga_trg on "vagasLAZ";
create trigger assina_vaga_trg
  before insert on "vagasLAZ"
  for each row execute function public.assina_vaga();

-- 4) E-mails da equipe: minúsculas + formato -------------------
-- (evita "Fulano@Empresa.com" não bater com o e-mail do login)
create or replace function public.normaliza_membro()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  if new.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido.';
  end if;
  return new;
end;
$$;

drop trigger if exists normaliza_membro_trg on "adminsLAZ";
create trigger normaliza_membro_trg
  before insert or update on "adminsLAZ"
  for each row execute function public.normaliza_membro();

-- Normaliza os já cadastrados.
update "adminsLAZ" set email = lower(trim(email)) where email <> lower(trim(email));

-- 5) Trilha de auditoria --------------------------------------
create table if not exists "auditoriaLAZ" (
  id        bigint generated always as identity primary key,
  quando    timestamptz not null default now(),
  quem      text,
  acao      text not null,     -- ex.: status_candidatura, exclui_vaga, papel_equipe
  alvo      text,              -- id/e-mail do registro afetado
  detalhe   jsonb
);
create index if not exists "auditoriaLAZ_quando_idx" on "auditoriaLAZ" (quando desc);

-- Só admin lê a auditoria; ninguém escreve via API (as triggers escrevem).
alter table "auditoriaLAZ" enable row level security;
drop policy if exists "admin le auditoria" on "auditoriaLAZ";
create policy "admin le auditoria"
  on "auditoriaLAZ" for select
  to authenticated
  using (public.eh_admin_laz());

create or replace function public.audita_laz()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  quem text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'sistema');
begin
  if tg_table_name = 'candidaturasLAZ' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'status_candidatura', new.id::text,
              jsonb_build_object('nome', new.nome, 'de', old.status, 'para', new.status));
    elsif tg_op = 'DELETE' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'exclui_candidatura', old.id::text,
              jsonb_build_object('nome', old.nome, 'cpf', old.cpf));
    end if;
  elsif tg_table_name = 'vagasLAZ' then
    if tg_op = 'INSERT' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'publica_vaga', new.id::text, jsonb_build_object('titulo', new.titulo));
    elsif tg_op = 'UPDATE' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'atualiza_vaga', new.id::text,
              jsonb_build_object('titulo', new.titulo, 'status', new.status));
    elsif tg_op = 'DELETE' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'exclui_vaga', old.id::text, jsonb_build_object('titulo', old.titulo));
    end if;
  elsif tg_table_name = 'adminsLAZ' then
    if tg_op = 'INSERT' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'adiciona_equipe', new.email, jsonb_build_object('papel', new.papel));
    elsif tg_op = 'UPDATE' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'papel_equipe', new.email,
              jsonb_build_object('de', old.papel, 'para', new.papel));
    elsif tg_op = 'DELETE' then
      insert into "auditoriaLAZ" (quem, acao, alvo, detalhe)
      values (quem, 'remove_equipe', old.email, jsonb_build_object('papel', old.papel));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists audita_candidaturas_trg on "candidaturasLAZ";
create trigger audita_candidaturas_trg
  after update or delete on "candidaturasLAZ"
  for each row execute function public.audita_laz();

drop trigger if exists audita_vagas_trg on "vagasLAZ";
create trigger audita_vagas_trg
  after insert or update or delete on "vagasLAZ"
  for each row execute function public.audita_laz();

drop trigger if exists audita_equipe_trg on "adminsLAZ";
create trigger audita_equipe_trg
  after insert or update or delete on "adminsLAZ"
  for each row execute function public.audita_laz();
