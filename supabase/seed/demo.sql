-- DADOS DEMONSTRATIVOS
-- Não execute este arquivo em um laboratório real.
-- Ele cria registros marcados como demonstração e pode ser apagado pelo bloco final.

insert into public.laboratories (name, code, color, notes)
values ('Laboratório demonstração', 'DEMO', '#0e6b62', 'Registro demonstrativo. Remover após o treinamento.')
on conflict (code) do nothing;

insert into public.sellers (name, notes)
select 'Vendedor demonstração', 'Registro demonstrativo. Remover após o treinamento.'
where not exists (
  select 1 from public.sellers where name = 'Vendedor demonstração'
);

-- Para remover:
-- delete from public.service_orders where client_name = 'LOJA DEMONSTRAÇÃO';
-- delete from public.sellers where name = 'Vendedor demonstração';
-- delete from public.laboratories where code = 'DEMO';
