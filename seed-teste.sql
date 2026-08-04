-- ============================================================
-- DADOS DE TESTE — 10 candidaturas fake para visualizar o painel
-- Rode no SQL Editor. Os CPFs/e-mails são fictícios (@teste.laz).
--
-- Para APAGAR depois, rode:
--   delete from "candidaturasLAZ" where email like '%@teste.laz';
-- ============================================================

insert into "candidaturasLAZ"
  (nome, cpf, email, cursos, vaga,
   cv_atualizado, cv_informa_lito, leu_vaga, autoriza_compartilhar, info_verdadeiras,
   status, criado_em, enviado_em)
values
  ('Mariana Souza Lima', '111.444.777-35', 'mariana.lima@teste.laz',
   'Comissário de Voo', 'Comissária de Voo',
   'Sim', 'Sim', 'Sim', 'Sim', 'Sim',
   'nova', now() - interval '2 hours', now() - interval '2 hours'),

  ('Carlos Eduardo Pereira', '222.333.444-05', 'carlos.pereira@teste.laz',
   'Mecânico Básico + GMP', 'Auxiliar de Mecânico de Aeronaves',
   'Sim', 'Sim', 'Sim', 'Sim', 'Sim',
   'nova', now() - interval '5 hours', now() - interval '5 hours'),

  ('Ana Beatriz Rocha', '333.222.111-84', 'ana.rocha@teste.laz',
   'Agente de Aeroporto', 'Agente de Atendimento Aeroportuário',
   'Sim', 'Não', 'Sim', 'Sim', 'Sim',
   'nova', now() - interval '1 day', now() - interval '1 day'),

  ('João Pedro Fernandes', '444.555.666-31', 'joao.fernandes@teste.laz',
   'Comissário de Voo + Inglês para Aviação', 'Comissário de Voo',
   'Não', 'Sim', 'Sim', 'Sim', 'Sim',
   'em_analise', now() - interval '2 days', now() - interval '2 days'),

  ('Larissa Almeida Costa', '555.666.777-79', 'larissa.costa@teste.laz',
   'Despachante Operacional de Voo', 'Despachante Operacional',
   'Sim', 'Sim', 'Sim', 'Sim', 'Sim',
   'em_analise', now() - interval '3 days', now() - interval '3 days'),

  ('Rafael Oliveira Santos', '666.777.888-16', 'rafael.santos@teste.laz',
   'Mecânico de Manutenção Aeronáutica', 'Mecânico de Aeronaves — GRU',
   'Sim', 'Sim', 'Não', 'Sim', 'Sim',
   'em_analise', now() - interval '4 days', now() - interval '4 days'),

  ('Fernanda Cardoso Nunes', '777.888.999-53', 'fernanda.nunes@teste.laz',
   'Agente de Aeroporto + Cargas', 'Agente de Operações — VCP',
   'Sim', 'Sim', 'Sim', 'Sim', 'Sim',
   'indicada', now() - interval '6 days', now() - interval '6 days'),

  ('Bruno Henrique Martins', '888.999.000-90', 'bruno.martins@teste.laz',
   'Comissário de Voo', 'Comissário de Voo — Base CNF',
   'Sim', 'Sim', 'Sim', 'Sim', 'Sim',
   'indicada', now() - interval '8 days', now() - interval '8 days'),

  ('Juliana Ribeiro Alves', '999.000.111-28', 'juliana.alves@teste.laz',
   'Agente de Aeroporto', 'Agente de Atendimento — REC',
   'Sim', 'Sim', 'Sim', 'Não', 'Sim',
   'arquivada', now() - interval '12 days', now() - interval '12 days'),

  ('Thiago Moreira Barbosa', '000.111.222-64', 'thiago.barbosa@teste.laz',
   'Mecânico Básico', 'Estágio em Manutenção — VCP',
   'Não', 'Não', 'Sim', 'Sim', 'Sim',
   'arquivada', now() - interval '15 days', now() - interval '15 days');
