-- Remove os DADOS DE SIMULAÇÃO criados em 24/10/2026.
-- Apaga só o que foi marcado: OS com número "SIM-…", lojas/vendedores com observação "[SIMULAÇÃO]"
-- e registros de Kaizen e auditoria 5S com is_demo = true.
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run.

begin;

create temporary table sim_orders on commit drop as
  select id from public.service_orders where number like 'SIM-%';

delete from public.attachments
  where entity_type = 'order' and entity_id in (select id from sim_orders)
     or entity_type = 'step' and entity_id in (select id from public.assembly_steps where order_id in (select id from sim_orders))
     or entity_type = 'occurrence' and entity_id in (select id from public.quality_occurrences where order_id in (select id from sim_orders));
delete from public.quality_actions where occurrence_id in (select id from public.quality_occurrences where order_id in (select id from sim_orders));
delete from public.quality_occurrences where order_id in (select id from sim_orders);
delete from public.order_messages where order_id in (select id from sim_orders);
delete from public.assembly_step_history where order_id in (select id from sim_orders);
delete from public.assembly_steps where order_id in (select id from sim_orders);
delete from public.order_status_history where order_id in (select id from sim_orders);
delete from public.service_orders where id in (select id from sim_orders);

alter table public.stores disable trigger stores_no_delete;
alter table public.sellers disable trigger sellers_no_delete;

delete from public.portal_credentials
  where store_id in (select id from public.stores where notes like '[SIMULAÇÃO]%')
     or seller_id in (select id from public.sellers where notes like '[SIMULAÇÃO]%');
delete from public.seller_stores
  where store_id in (select id from public.stores where notes like '[SIMULAÇÃO]%')
     or seller_id in (select id from public.sellers where notes like '[SIMULAÇÃO]%');
delete from public.sellers where notes like '[SIMULAÇÃO]%';
delete from public.stores where notes like '[SIMULAÇÃO]%';

alter table public.stores enable trigger stores_no_delete;
alter table public.sellers enable trigger sellers_no_delete;

delete from public.kaizen_ideas where is_demo;
delete from public.five_s_audits where is_demo;

commit;
