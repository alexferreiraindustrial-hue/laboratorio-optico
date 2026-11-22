-- Read-only verification. Run the first two queries before and after migration.
select count(*) as orders_count, md5(coalesce(jsonb_agg(to_jsonb(o)-'frame_state'-'express_minutes'-'express_started_at'-'express_finished_at' order by id)::text,'[]')) as existing_fields_fingerprint from public.service_orders o;
select count(*) as sellers_count, md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) as sellers_fingerprint from public.sellers s;
-- After migration: verify schema only; no order writes.
select column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='service_orders' and column_name in ('frame_state','express_minutes','express_started_at','express_finished_at');
select to_regprocedure('public.receive_order_lenses(uuid)') as receive_lenses, to_regprocedure('public.receive_order_frame(uuid,integer)') as receive_frame, to_regclass('public.order_notice_logs') as notices;
