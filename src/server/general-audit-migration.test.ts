import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const user = "00000000-0000-4000-8000-000000000001";
const role = (name: string) => db.exec(`set test.role='${name}'`);
async function make(status: string, client = "Cliente") {
  return (await db.query<{ id: string }>("insert into service_orders(status,client_name) values($1,$2) returning id", [status, client])).rows[0].id;
}
const enriched = async () => (await db.query<{ id: string }>("select id from orders_enriched")).rows.map((r) => r.id);
const all = async () => (await db.query<{ id: string }>("select id from orders_enriched_all")).rows.map((r) => r.id);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${user}');
    create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
    create function public.current_app_role() returns text language sql as $$select nullif(current_setting('test.role',true),'')$$;
    set test.role='admin';
    create table laboratories(id uuid primary key default gen_random_uuid(), name text);
    insert into laboratories(id,name) values('00000000-0000-4000-8000-0000000000aa','Lab');
    create table service_orders(id uuid primary key default gen_random_uuid(), client_name text, status text not null,
      laboratory_id uuid default '00000000-0000-4000-8000-0000000000aa' references laboratories(id), notes text default 'Não alterar');
    create table order_status_history(order_id uuid, from_status text, to_status text, note text, user_id uuid);
    create view orders_enriched with (security_invoker = true) as
      select o.*, l.name as laboratory_name from service_orders o join laboratories l on l.id = o.laboratory_id;
  `);
  await db.exec(readFileSync("supabase/migrations/20261128120000_general_audit.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261128150000_general_audit_standby.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

it("auditoria geral: bipadas ficam, não encontradas vão para off sem perder dados e voltam ao bipar", async () => {
  const found = await make("pronto", "Ana");
  const missing = await make("pronto", "Beto");
  const keep = await make("em_montagem", "Caio");
  const delivered = await make("entregue", "Davi");
  await db.query("select start_general_audit()");
  const snap = (await db.query<{ order_id: string }>("select order_id from audit_session_orders")).rows.map((r) => r.order_id);
  expect(snap.sort()).toEqual([found, missing, keep].sort());

  await role("montador");
  await db.query("select audit_mark_found($1,'pronto')", [found]);
  await role("admin");
  await db.query("select finish_general_audit($1)", [[missing, found, delivered]]);

  expect(await enriched()).not.toContain(missing);
  expect(await enriched()).toEqual(expect.arrayContaining([found, keep, delivered]));
  expect(await all()).toContain(missing);
  const row = (await db.query<Record<string, unknown>>("select status,notes,client_name from service_orders where id=$1", [missing])).rows[0];
  expect(row).toEqual({ status: "pronto", notes: "Não alterar", client_name: "Beto" });
  const session = (await db.query<{ off_count: number; finished_at: string | null }>("select off_count, finished_at from audit_sessions")).rows[0];
  expect(session.off_count).toBe(1);
  expect(session.finished_at).not.toBeNull();

  await role("montador");
  await db.query("select audit_mark_found($1,'em_montagem')", [missing]);
  expect(await enriched()).toContain(missing);
  const notes = (await db.query<{ note: string }>("select note from order_status_history where order_id=$1", [missing])).rows.map((r) => r.note);
  expect(notes[0]).toMatch(/colocada em off/);
  expect(notes[1]).toMatch(/voltou a ficar ativa/);
});

it("só admin ou gestor inicia e encerra; consulta não reativa", async () => {
  await role("montador");
  await expect(db.query("select start_general_audit()")).rejects.toThrow(/administrador ou gestor/);
  await role("consulta");
  const id = await make("pronto");
  await expect(db.query("select reactivate_order($1)", [id])).rejects.toThrow(/acesso/);
  await role("admin");
});

it("portal sabe quais OS da lista estão em off", async () => {
  await db.query("select start_general_audit()");
  const a = await make("pronto");
  await db.query("insert into audit_session_orders(session_id,order_id) select id,$1 from audit_sessions where finished_at is null", [a]);
  await db.query("select finish_general_audit($1)", [[a]]);
  const hidden = (await db.query<{ portal_hidden_orders: string }>("select portal_hidden_orders($1)", [[a]])).rows.map((r) => r.portal_hidden_orders);
  expect(hidden).toEqual([a]);
});

it("modo do zero: tudo em standby ao iniciar, volta ao bipar, cancelar reativa o resto", async () => {
  const a = await make("pronto", "Eva");
  const b = await make("em_montagem", "Fabio");
  const c = await make("aguardando_lentes", "Gil");
  await db.query("select start_general_audit_standby()");
  const visible = await enriched();
  expect(visible).not.toContain(a);
  expect(visible).not.toContain(b);
  expect(await all()).toEqual(expect.arrayContaining([a, b, c]));
  await role("montador");
  await db.query("select audit_mark_found($1,'pronto')", [a]);
  await role("admin");
  expect(await enriched()).toContain(a);
  await db.query("select cancel_general_audit()");
  expect(await enriched()).toEqual(expect.arrayContaining([a, b, c]));

  await db.query("select start_general_audit_standby()");
  await db.query("select audit_mark_found($1,'em_montagem')", [b]);
  const done = (await db.query<{ off_count: number }>("select (finish_general_audit('{}')).off_count")).rows[0];
  expect(await enriched()).toContain(b);
  expect(await enriched()).not.toContain(a);
  expect(done.off_count).toBeGreaterThanOrEqual(2);
  const row = (await db.query<Record<string, unknown>>("select status,client_name from service_orders where id=$1", [c])).rows[0];
  expect(row).toEqual({ status: "aguardando_lentes", client_name: "Gil" });
});
