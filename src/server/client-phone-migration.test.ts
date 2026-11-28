import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const user = "00000000-0000-4000-8000-000000000001";
async function make(status: string, number: string, external: string | null = null, phone: string | null = null) {
  return (await db.query<{ id: string }>(
    "insert into service_orders(status,number,external_order_id,client_phone,client_name) values($1,$2,$3,$4,'Cliente') returning id",
    [status, number, external, phone],
  )).rows[0].id;
}
const role = (name: string) => db.exec(`set test.role='${name}'`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${user}');
    create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
    create function public.current_app_role() returns text language sql as $$select nullif(current_setting('test.role',true),'')$$;
    set test.role='montador';
    create table service_orders(id uuid primary key default gen_random_uuid(), number text, external_order_id text, client_name text, status text not null, notes text default 'Não alterar');
    create table order_status_history(order_id uuid, from_status text, to_status text, note text, user_id uuid);
    create table client_delivery_followups(id uuid primary key default gen_random_uuid(), order_id uuid not null unique references service_orders(id),
      client_delivered_at timestamptz not null, followup_due_at timestamptz not null, client_phone text, confirmed_by uuid not null references auth.users(id),
      contacted_at timestamptz, outcome text);
  `);
  await db.exec(readFileSync("supabase/migrations/20261127210000_client_phone_followup.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

it("grava o telefone do cliente só com números e registra no histórico", async () => {
  const id = await make("pronto", "4521");
  await db.query("select set_order_client_phone($1,'(12) 99697-6233')", [id]);
  const row = (await db.query<Record<string, unknown>>("select client_phone,notes from service_orders where id=$1", [id])).rows[0];
  expect(row).toEqual({ client_phone: "12996976233", notes: "Não alterar" });
  const notes = (await db.query<{ note: string }>("select note from order_status_history where order_id=$1", [id])).rows;
  expect(notes).toEqual([{ note: "Telefone do cliente atualizado" }]);
  await expect(db.query("select set_order_client_phone($1,'123')", [id])).rejects.toThrow(/DDD/);
});

it("consulta não altera o telefone", async () => {
  const id = await make("pronto", "4522");
  await role("consulta");
  await expect(db.query("select set_order_client_phone($1,'12996976233')", [id])).rejects.toThrow(/acesso/);
  await role("montador");
});

it("OS entregue com número da loja entra no pós-venda uma vez, com o telefone", async () => {
  const id = await make("entregue", "4530", null, "12996976233");
  await db.query("select ensure_client_followup($1)", [id]);
  await db.query("select ensure_client_followup($1)", [id]);
  const rows = (await db.query<{ client_phone: string; days: number }>(
    "select client_phone, round(extract(epoch from followup_due_at-client_delivered_at)/86400)::int as days from client_delivery_followups where order_id=$1", [id])).rows;
  expect(rows).toEqual([{ client_phone: "12996976233", days: 5 }]);
});

it("ignora OS sem número da loja ou que não saiu", async () => {
  const auto = await make("entregue", "OS-2026-000123");
  const open = await make("pronto", "4540");
  const informed = await make("entregue", "OS-2026-000124", "8899");
  await db.query("select ensure_client_followup($1)", [auto]);
  await db.query("select ensure_client_followup($1)", [open]);
  await db.query("select ensure_client_followup($1)", [informed]);
  const ids = (await db.query<{ order_id: string }>("select order_id from client_delivery_followups where order_id = any($1)", [[auto, open, informed]])).rows.map((r) => r.order_id);
  expect(ids).toEqual([informed]);
});
