-- ============================================================
-- Nova pergunta do formulário: disponibilidade para mudança
-- de estado. Rode UMA vez no SQL Editor.
-- ============================================================

alter table "candidaturasLAZ"
  add column if not exists disponibilidade_mudanca text;

-- Inclui o novo campo na validação Sim/Não do servidor.
alter table "candidaturasLAZ" drop constraint if exists "candLAZ_simnao_chk";
alter table "candidaturasLAZ" add constraint "candLAZ_simnao_chk"
  check (
    coalesce(cv_atualizado, '')           in ('', 'Sim', 'Não') and
    coalesce(cv_informa_lito, '')         in ('', 'Sim', 'Não') and
    coalesce(leu_vaga, '')                in ('', 'Sim', 'Não') and
    coalesce(autoriza_compartilhar, '')   in ('', 'Sim', 'Não') and
    coalesce(info_verdadeiras, '')        in ('', 'Sim', 'Não') and
    coalesce(disponibilidade_mudanca, '') in ('', 'Sim', 'Não')
  );
