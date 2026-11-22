import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {beforeAll,afterAll,it,expect} from "vitest";
let db:PGlite;
const user="00000000-0000-4000-8000-000000000001";
async function row(id:string){return (await db.query<Record<string,unknown>>("select * from service_orders where id=$1",[id])).rows[0];}
async function create(frame="unknown",minutes:number|null=null){const payload={p_client_name:"Teste isolado",p_laboratory_id:user,p_seller_id:user,p_entered_at:new Date().toISOString(),p_service_description:"Teste",p_status:"aguardando_lentes",p_priority:"normal"};return (await db.query<{id:string}>("select id from create_service_order_configured($1::jsonb,$2,$3)",[JSON.stringify(payload),frame,minutes])).rows[0].id;}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create schema auth;create schema extensions;
 create table auth.users(id uuid primary key);insert into auth.users values('${user}');
 create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
 create function public.current_app_role() returns text language sql as $$select nullif(current_setting('test.role',true),'')$$;
 set test.role='admin';
 create table service_orders(id uuid primary key default gen_random_uuid(),number text not null default gen_random_uuid()::text,client_name text not null,seller_id uuid,store_id uuid,laboratory_id uuid,entered_at timestamptz not null default now(),due_at timestamptz,notes text,service_description text,external_order_id text,priority text,status text not null default 'aguardando_lentes',lens_spec jsonb default '{}',lens_arrived_at timestamptz,completed_at timestamptz,updated_at timestamptz not null default clock_timestamp(),updated_by uuid);
 create table order_status_history(id uuid default gen_random_uuid(),order_id uuid,from_status text,to_status text,note text,user_id uuid,created_at timestamptz default now());
 create table sellers(id uuid primary key default gen_random_uuid(),name text,quick_code int,active boolean default true,email text,access_pin_hash text);
 create table portal_credentials(subject_type text,seller_id uuid,token_hash text,token_prefix text,access_kind text,revoked_at timestamptz);
 create function public.portal_rate_hit(text,int,interval) returns void language sql as $$select$$;
 create function extensions.crypt(text,text) returns text language sql as $$select $1$$;
 create function extensions.gen_random_bytes(int) returns bytea language sql as $$select decode(repeat('ab',$1),'hex')$$;
 create function extensions.digest(text,text) returns bytea language sql as $$select decode('aabb','hex')$$;
 create function public.create_service_order(p_client_name text,p_seller_id uuid,p_laboratory_id uuid,p_entered_at timestamptz,p_due_at timestamptz,p_notes text,p_service_description text,p_external_order_id text,p_priority text,p_status text,p_lens_spec jsonb,p_store_id uuid default null) returns service_orders language plpgsql as $$declare o service_orders;begin insert into service_orders(client_name,seller_id,laboratory_id,entered_at,due_at,notes,service_description,external_order_id,priority,status,lens_spec,store_id) values(p_client_name,p_seller_id,p_laboratory_id,p_entered_at,p_due_at,p_notes,p_service_description,p_external_order_id,p_priority,p_status,p_lens_spec,p_store_id) returning * into o;return o;end$$;
 create function public.change_order_status(p_order_id uuid,p_to text,p_note text) returns service_orders language plpgsql as $$declare o service_orders;begin update service_orders set status=p_to where id=p_order_id returning * into o;insert into order_status_history(order_id,to_status,note) values(p_order_id,p_to,p_note);return o;end$$;
 insert into service_orders(id,client_name,status,notes,lens_spec) values('${user}','Registro real preservado','em_montagem','Não alterar','{"frame":"original"}');
 insert into sellers(id,name,quick_code,access_pin_hash) values('${user}','Ana Silva',1,'senha-original');
 `);
 await db.exec(readFileSync("supabase/migrations/20261122120000_vta_express_notices.sql","utf8"));
},30000);
afterAll(async()=>{await db?.close();});
it("applies additive migration without rewriting existing records or credentials",async()=>{const original=await row(user);expect(original).toMatchObject({client_name:"Registro real preservado",status:"em_montagem",notes:"Não alterar",lens_spec:{frame:"original"},frame_state:null,express_minutes:null,express_started_at:null});expect((await db.query<{access_pin_hash:string}>("select access_pin_hash from sellers where id=$1",[user])).rows[0].access_pin_hash).toBe("senha-original");});
it("records a VTA lens receipt without moving it to the bench, blocks legacy status bypass and then accepts frame arrival",async()=>{
 const id=await create("vta");await db.query("select receive_order_lenses($1)",[id]);expect(await row(id)).toMatchObject({status:"aguardando_lentes",frame_state:"vta"});expect((await row(id)).lens_arrived_at).toBeTruthy();
 await expect(db.query("select change_order_status($1,'aguardando_montagem','old app')",[id])).rejects.toThrow("VTA");
 await db.query("select receive_order_frame($1,40)",[id]);expect(await row(id)).toMatchObject({status:"aguardando_montagem",frame_state:"present",express_minutes:40,express_started_at:null});
});
it("does not fake lens arrival when the frame arrives first",async()=>{const id=await create("vta");await db.query("select receive_order_frame($1,20)",[id]);expect(await row(id)).toMatchObject({status:"aguardando_lentes",lens_arrived_at:null});await db.query("select receive_order_lenses($1)",[id]);expect(await row(id)).toMatchObject({status:"aguardando_montagem",express_minutes:20});});
it("starts the clock only on assembly start, cannot rewrite it, and freezes on assembly completion",async()=>{
 const id=await create("present",60);expect(await row(id)).toMatchObject({status:"aguardando_montagem",express_started_at:null});await db.query("select change_order_status($1,'em_montagem','start')",[id]);const started=(await row(id)).express_started_at;expect(started).toBeTruthy();
 await db.query("update service_orders set express_started_at=now()+interval '1 hour' where id=$1",[id]);expect((await row(id)).express_started_at).toEqual(started);
 await expect(db.query("select configure_order_operations($1,'present',20,null)",[id])).rejects.toThrow();
 await db.query("select change_order_status($1,'em_conferencia','done')",[id]);expect((await row(id)).express_finished_at).toBeTruthy();
});
it("rolls back invalid configured creation instead of leaving a partial service",async()=>{const before=(await db.query<{count:number}>("select count(*)::int as count from service_orders")).rows[0].count;await expect(create("vta",40)).rejects.toThrow();await expect(create("unknown",30)).rejects.toThrow();expect((await db.query<{count:number}>("select count(*)::int as count from service_orders")).rows[0].count).toBe(before);});
it("denies anonymous and read-only operations, and keeps notices independent from receipt",async()=>{
 const id=await create("vta");await db.exec("set test.role='consulta'");await expect(db.query("select receive_order_lenses($1)",[id])).rejects.toThrow("Sem permissão");await db.exec("set test.role=''");await expect(db.query("select receive_order_frame($1,40)",[id])).rejects.toThrow("Sem permissão");await db.exec("set test.role='admin'");
 await db.query("select receive_order_lenses($1)",[id]);expect((await db.query<{count:number}>("select count(*)::int as count from order_notice_logs where order_id=$1",[id])).rows[0].count).toBe(0);
 const event=(await row(id)).lens_arrived_at;await db.query("select mark_order_notice($1,'vta',$2,'seller')",[id,event]);await db.query("select mark_order_notice($1,'vta',$2,'seller')",[id,event]);expect((await db.query<{count:number}>("select count(*)::int as count from order_notice_logs where order_id=$1",[id])).rows[0].count).toBe(1);
});
it("accepts unique full seller name while preserving password and denying duplicate names",async()=>{
 const result=await db.query("select seller_app_login('  ANA SILVA  ','senha-original','abcdefgh') as access");expect(result.rows[0]).toBeTruthy();
 await db.exec("insert into sellers(name,quick_code,access_pin_hash) values('Ana Silva',2,'senha-original')");await expect(db.query("select seller_app_login('Ana Silva','senha-original','abcdefgh')")).rejects.toThrow("inválidos");await expect(db.query("select seller_app_login('v1','wrong','abcdefgh')")).rejects.toThrow("inválidos");
});

it("rejects outdated operation edits and prevents confirmation of the wrong notification event",async()=>{
 const id=await create();await expect(db.query("select configure_order_operations($1,'present',20,'2000-01-01'::timestamptz)",[id])).rejects.toThrow("outra pessoa");
 await expect(db.query("select mark_order_notice($1,'received','2000-01-01'::timestamptz,'seller')",[id])).rejects.toThrow("evento da OS mudou");
});

it("can be reapplied without changing active services, counters, notices or seller passwords",async()=>{
 const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(o) order by id) from service_orders o) orders,(select jsonb_agg(to_jsonb(n) order by id) from order_notice_logs n) notices,(select jsonb_agg(to_jsonb(s) order by id) from sellers s) sellers")).rows);
 const before=await snapshot();await db.exec(readFileSync("supabase/migrations/20261122120000_vta_express_notices.sql","utf8"));expect(await snapshot()).toBe(before);
});
