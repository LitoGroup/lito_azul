-- ============================================================
-- AJUSTE DOS RATE LIMITS — valores folgados para uso real,
-- mantendo a proteção contra abuso. Rode UMA vez no SQL Editor.
-- (Substitui as funções criadas pelo ratelimit-setup.sql.)
--
--                       antes        agora
--   Candidatura/IP:     3/hora   →   30/hora   (turma no mesmo wi-fi)
--   Candidatura/CPF:    2/dia    →   3/dia     (corrigir e reenviar)
--   Candidatura global: 60/hora  →   300/hora  (pico de lançamento)
--   Upload/IP:          10/hora  →   80/hora   (2 arquivos por envio + retentativas)
--   Upload global:      150/hora →   600/hora
--   Vagas/usuário:      20/hora  →   40/hora
-- ============================================================

create or replace function public.limita_candidatura()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ip  text;
  cpf text;
begin
  if public.laz_role_req() <> 'anon' then
    return new;
  end if;

  ip  := public.laz_ip_req();
  cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  if not public.laz_limita('cand:global', 300, interval '1 hour') then
    raise exception 'Limite de envios do sistema atingido no momento. Tente novamente em alguns minutos.';
  end if;
  if not public.laz_limita('cand:ip:' || ip, 30, interval '1 hour') then
    raise exception 'Muitos envios a partir desta rede. Aguarde um pouco e tente novamente.';
  end if;
  if not public.laz_limita('cand:cpf:' || cpf, 3, interval '1 day') then
    raise exception 'Já recebemos candidaturas com este CPF hoje. Tente novamente amanhã.';
  end if;

  return new;
end;
$$;

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

  if not public.laz_limita('up:global', 600, interval '1 hour') then
    raise exception 'Limite de envios do sistema atingido no momento. Tente novamente em alguns minutos.';
  end if;
  if not public.laz_limita('up:ip:' || ip, 80, interval '1 hour') then
    raise exception 'Muitos arquivos enviados desta rede. Aguarde um pouco e tente novamente.';
  end if;

  return new;
end;
$$;

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

  if not public.laz_limita('vaga:' || quem, 40, interval '1 hour') then
    raise exception 'Muitas vagas publicadas em pouco tempo. Aguarde um pouco.';
  end if;

  return new;
end;
$$;

-- Zera os contadores acumulados durante os testes.
delete from "rateLimitLAZ";
