-- Dados de SIMULAÇÃO para a Melhoria contínua (Kaizen e auditorias 5S).
-- Tudo marcado com is_demo = true; remova com supabase/remover-dados-simulacao.sql.

begin;

delete from public.kaizen_ideas where is_demo;
delete from public.five_s_audits where is_demo;

with people as (
  select
    (select id from public.profiles where role in ('admin', 'gestor') and active order by created_at limit 1) as gestor,
    coalesce(
      (select id from public.profiles where role = 'montador' and active order by created_at limit 1),
      (select id from public.profiles where active order by created_at limit 1)
    ) as montador
)
insert into public.kaizen_ideas
  (title, problem, proposal, area, category, status, impact, effort, whys, root_cause, result, gain_minutes_day,
   owner_id, created_by, started_at, created_at, is_demo)
select v.title, v.problem, v.proposal, v.area, v.category, v.status, v.impact, v.effort, v.whys::jsonb, v.root_cause, v.result,
       v.gain, case when v.dono = 'g' then p.gestor else p.montador end, p.montador,
       case when v.status <> 'ideia' then now() - (v.dias || ' days')::interval + interval '2 days' end,
       now() - (v.dias || ' days')::interval, true
from people p,
(values
  ('Quadro de sombras para ferramentas da bancada',
   'Montador perde tempo procurando alicate, chave e pinça durante a montagem.',
   'Painel com silhueta de cada ferramenta ao lado da bancada; ferramenta fora do lugar fica visível.',
   'Bancada de montagem', '5s', 'padronizada', 3, 1,
   '["Montador procura ferramentas","Ferramentas não têm lugar definido","Bancada foi montada sem layout","Nunca houve padrão de organização","Não havia rotina de 5S"]',
   'Falta de lugar definido para cada ferramenta (Seiton).',
   'Tempo de procura caiu de ~6 min para ~1 min por montador/dia.', 20, 'm', 40),
  ('Checklist de lensometria antes da blocagem',
   'Grau divergente só é percebido na conferência final, gerando retrabalho.',
   'Checklist rápido na etapa de lensometria comparando com o pedido, com bloqueio se houver divergência.',
   'Lensometria', 'qualidade', 'padronizada', 3, 2,
   '["Grau divergente aparece no final","Conferência acontece só no fim","Não há verificação na lensometria","Etapa era feita de memória","Sem trabalho padronizado"]',
   'Ausência de verificação padronizada na lensometria (poka-yoke).',
   'Ocorrências de grau divergente caíram cerca de 60% no mês seguinte.', 35, 'g', 32),
  ('Kanban de reposição de lentes de giro rápido',
   'Lentes mais usadas acabam e a OS fica parada aguardando compra.',
   'Cartão kanban no ponto mínimo do estoque dispara o pedido automático.',
   'Estoque de lentes', 'fluxo', 'verificacao', 3, 2,
   '["OS parada aguardando lente","Lente acabou no estoque","Reposição só quando zera","Não existe ponto de pedido","Estoque não é puxado pelo consumo"]',
   'Reposição empurrada, sem ponto de pedido (sistema puxado).', null, 25, 'g', 18),
  ('Suporte de altura regulável na facetadora',
   'Operador trabalha curvado ao carregar a facetadora, gerando cansaço no fim do turno.',
   'Plataforma regulável e tapete antifadiga.',
   'Facetadora', 'ergonomia', 'em_teste', 2, 2,
   '[]', null, null, null, 'm', 10),
  ('Etiqueta colorida por prazo na bandeja',
   'Difícil enxergar quais OS vencem hoje no meio das bandejas.',
   'Etiqueta vermelha (hoje), amarela (amanhã) e verde (depois) — gestão à vista.',
   'Bancada de montagem', 'fluxo', 'em_teste', 2, 1,
   '[]', null, null, 10, 'm', 7),
  ('Padronizar limpeza da facetadora a cada turno',
   'Resíduo acumulado prejudica o acabamento da borda.',
   'Rotina de limpeza de 5 minutos no fim do turno com registro no checklist 5S.',
   'Facetadora', '5s', 'ideia', 2, 1,
   '[]', null, null, null, 'm', 4),
  ('Reaproveitar caixas de lente como separadores',
   'Compra de separadores plásticos para bandejas.',
   'Usar as caixas das lentes recortadas como divisórias.',
   'Estoque de lentes', 'custo', 'ideia', 1, 1,
   '[]', null, null, null, 'm', 2),
  ('Luvas para manuseio de lentes com antirreflexo',
   'Marcas de dedo e riscos em lentes com tratamento.',
   'Uso obrigatório de luva de nitrila nas etapas de blocagem e conferência.',
   'Conferência de qualidade', 'seguranca', 'descartada', 1, 1,
   '[]', null, 'Descartada: pano de microfibra resolveu com menor custo.', null, 'g', 25)
) as v(title, problem, proposal, area, category, status, impact, effort, whys, root_cause, result, gain, dono, dias);

-- Auditorias 5S semanais nas 4 áreas nas últimas 8 semanas, com evolução gradual.
insert into public.five_s_audits (area, audited_at, auditor_id, seiri, seiton, seiso, seiketsu, shitsuke, notes, is_demo)
select
  a.area,
  date_trunc('day', now()) - ((7 - w) * 7 || ' days')::interval + interval '10 hours' + (a.ordem || ' hours')::interval,
  (select id from public.profiles where role in ('admin', 'gestor') and active order by created_at limit 1),
  least(5, round((a.base + w * 0.28 + 0.4)::numeric * 2) / 2),
  least(5, round((a.base + w * 0.32 + (case when w >= 3 then 0.6 else 0 end))::numeric * 2) / 2),
  least(5, round((a.base + w * 0.22 + 0.2)::numeric * 2) / 2),
  least(5, round((a.base + w * 0.20 - 0.3)::numeric * 2) / 2),
  least(5, round((a.base + w * 0.18 - 0.5)::numeric * 2) / 2),
  case when w = 7 then 'Auditoria de rotina.' when w = 3 then 'Implantado quadro de sombras e etiquetas de prazo.' end,
  true
from (values
  ('Bancada de montagem', 2.0, 0),
  ('Facetadora', 2.4, 1),
  ('Estoque de lentes', 1.8, 2),
  ('Conferência de qualidade', 2.8, 3)
) as a(area, base, ordem),
generate_series(0, 7) as w;

commit;
