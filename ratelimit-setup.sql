-- ============================================================
-- RATE LIMIT — rode UMA vez no SQL Editor.
--
-- Fecha as brechas de abuso do sistema DIRETO NO BANCO
-- (trigger + RLS): mesmo chamando a API na mão, o limite vale.
--
--   • Candidaturas (anon):  3/hora por IP · 2/dia por CPF · 60/hora global
--   • Uploads (anon):       10/hora por IP · 150/hora global
--   • Bucket:               máx. 8 MB por arquivo · só PDF/DOC/DOCX/JPG/PNG/WEBP
--   • Vagas (autenticado):  20/hora por usuário
--
-- Seeds e comandos do SQL Editor NÃO são afetados (rodam fora
-- da API, sem claims de anon/authenticated).
-- ============================================================

-- 1) Tabela de eventos do limitador ---------------------------
create table if not exists "rateLimitLAZ" (
  id        bigint generated always as identity primary key,
  chave     text not null,
  criado_em timestamptz not null default now()
);
create index if not exists "rateLimitLAZ_chave_idx"
  on "rateLimitLAZ" (chave, criado_em desc);

-- RLS ligado e sem políticas: invisível na API. Só as funções
-- SECURITY DEFINER abaixo escrevem nela.
alter table "rateLimitLAZ" enable row level security;

-- 2) Funções utilitárias --------------------------------------
-- Papel da requisição ('anon', 'authenticated' ou '' fora da API).
create or replace function public.laz_role_req()
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
$$;

-- IP de quem chamou (via cabeçalho do proxy).
create or replace function public.laz_ip_req()
returns text language sql stable as $$
  select coalesce(
    split_part(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
      ',', 1),
    'desconhecido'
  );
$$;

-- Registra 1 evento e diz se ainda está dentro do limite.
create or replace function public.laz_limita(p_chave text, p_max int, p_janela interval)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  qtd int;
begin
  -- limpeza oportunista (mantém a tabela pequena)
  if random() < 0.02 then
    delete from "rateLimitLAZ" where criado_em < now() - interval '2 days';
  end if;

  select count(*) into qtd
  from "rateLimitLAZ"
  where chave = p_chave and criado_em > now() - p_janela;

  if qtd >= p_max then
    return false;
  end if;

  insert into "rateLimitLAZ" (chave) values (p_chave);
  return true;
end;
$$;

-- 3) Limite: candidaturas (formulário público) ----------------
create or replace function public.limita_candidatura()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ip  text;
  cpf text;
begin
  -- Só limita chamadas da API feitas como anon (o formulário).
  if public.laz_role_req() <> 'anon' then
    return new;
  end if;

  ip  := public.laz_ip_req();
  cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  if not public.laz_limita('cand:global', 60, interval '1 hour') then
    raise exception 'Limite de envios do sistema atingido no momento. Tente novamente em alguns minutos.';
  end if;
  if not public.laz_limita('cand:ip:' || ip, 3, interval '1 hour') then
    raise exception 'Muitos envios a partir deste dispositivo. Aguarde um pouco e tente novamente.';
  end if;
  if not public.laz_limita('cand:cpf:' || cpf, 2, interval '1 day') then
    raise exception 'Já recebemos candidaturas com este CPF hoje. Tente novamente amanhã.';
  end if;

  return new;
end;
$$;

drop trigger if exists limita_candidatura_trg on "candidaturasLAZ";
create trigger limita_candidatura_trg
  before insert on "candidaturasLAZ"
  for each row execute function public.limita_candidatura();

-- 4) Limite: uploads no bucket de currículos ------------------
create or replace function public.limita_upload()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ip text;
begin
  if new.bucket_id <> 'curriculosLAZ' then
    return new;
  end if;
  if public.laz_role_req() <> 'anon' then
    return new;
  end if;

  ip := public.laz_ip_req();

  if not public.laz_limita('up:global', 150, interval '1 hour') then
    raise exception 'Limite de envios do sistema atingido no momento. Tente novamente em alguns minutos.';
  end if;
  if not public.laz_limita('up:ip:' || ip, 10, interval '1 hour') then
    raise exception 'Muitos arquivos enviados deste dispositivo. Aguarde um pouco e tente novamente.';
  end if;

  return new;
end;
$$;

drop trigger if exists limita_upload_trg on storage.objects;
create trigger limita_upload_trg
  before insert on storage.objects
  for each row execute function public.limita_upload();

-- 5) Bucket blindado: tamanho máximo e tipos permitidos -------
update storage.buckets
set
  file_size_limit = 8388608,  -- 8 MB
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ]
where id = 'curriculosLAZ';

-- 6) Limite: publicação de vagas (autenticado) ----------------
create or replace function public.limita_vaga()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  quem text;
begin
  if public.laz_role_req() <> 'authenticated' then
    return new;
  end if;

  quem := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'desconhecido');

  if not public.laz_limita('vaga:' || quem, 20, interval '1 hour') then
    raise exception 'Muitas vagas publicadas em pouco tempo. Aguarde um pouco.';
  end if;

  return new;
end;
$$;

drop trigger if exists limita_vaga_trg on "vagasLAZ";
create trigger limita_vaga_trg
  before insert on "vagasLAZ"
  for each row execute function public.limita_vaga();
