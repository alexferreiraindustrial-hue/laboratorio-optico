import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const user = "00000000-0000-4000-8000-000000000001";
const row = async (id: string) => (await db.query<Record<string, unknown>>("select * from service_orders where id=$1", [id])).rows[0];
const history = async (id: string) => (await db.query<{ from_status: string; to_status: string; note: string }>("select from_status,to_status,note from order_status_history where order_id=$1", [id])).rows;
async function make(status: string, extra: Record<string, unknown> = {}) {
  const fields = { status, completed_at: status === "pronto" ? "2026-11-25T10:00:00Z" : null, lens_arrived_at: "2026-11-24T10:00:00Z", frame_state: "unknown", ...extra };
  await db.exec("set app.status_write='on'");
  const id = (await db.query<{ id: string }>("insert into service_orders(status,completed_at,lens_arrived_at,frame_state,express_started_at,client_name) values($1,$2,$3,$4,$5,'Cliente') returning id", [fields.status, fields.completed_at, fields.lens_arrived_at, fields.frame_state, (extra.express_started_at as string) ?? null])).rows[0].id;
  await db.exec("set app.status_write='off'");
  return id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
    create function public.current_app_role() returns text language sql as $$select nullif(current_setting('test.role',true),'')$$;
    set test.role='admin';
    create table service_orders(id uuid primary key default gen_random_uuid(), client_name text, status text not null, completed_at timestamptz, lens_arrived_at timestamptz,
      frame_state text, express_started_at timestamptz, updated_by uuid, notes text default 'Não alterar');
    create table order_status_history(order_id uuid, from_status text, to_status text, note text, user_id uuid);
    create table steps(order_id uuid);
    create function public.ensure_assembly_steps(p uuid) returns void language sql as $$insert into steps values(p)$$;
    create function guard() returns trigger language plpgsql as $$begin
      if new.status is distinct from old.status and current_setting('app.status_write',true) is distinct from 'on' then raise exception 'Altere o status pela movimentação operacional.'; end if;
      if new.frame_state='vta' and new.status not in ('aguardando_lentes','cancelado') then raise exception 'VTA guard'; end if;
      return new; end$$;
    create trigger g before update on service_orders for each row execute function guard();
  `);
  await db.exec(readFileSync("supabase/migrations/20261126150000_reposition_order.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

it("desfaz o pronto para aguardando montagem e registra o motivo", async () => {
  const id = await make("pronto");
  await db.query("select reposition_order($1,'aguardando_montagem','dei pronto por engano')", [id]);
  expect(await row(id)).toMatchObject({ status: "aguardando_montagem", completed_at: null, notes: "Não alterar" });
  expect((await row(id)).lens_arrived_at).toBeTruthy();
  expect(await history(id)).toEqual([{ from_status: "pronto", to_status: "aguardando_montagem", note: "Pronto desfeito: dei pronto por engano" }]);
});

it("volta para aguardando lentes limpando a chegada e guardando a data antiga no histórico", async () => {
  const id = await make("pronto");
  await db.query("select reposition_order($1,'aguardando_lentes','lente não chegou')", [id]);
  expect(await row(id)).toMatchObject({ status: "aguardando_lentes", lens_arrived_at: null });
  expect((await history(id))[0].note).toContain("chegada da lente registrada antes: 24/11/2026");
});

it("coloca a OS em VTA: lente chegou, aguardando armação", async () => {
  const id = await make("aguardando_montagem", { lens_arrived_at: null });
  await db.query("select reposition_order($1,'vta','cliente vai trazer a armação')", [id]);
  const order = await row(id);
  expect(order).toMatchObject({ status: "aguardando_lentes", frame_state: "vta" });
  expect(order.lens_arrived_at).toBeTruthy();
  expect((await history(id))[0].note).toContain("[VTA");
});

it("em montagem prepara as etapas da bancada", async () => {
  const id = await make("pronto");
  await db.query("select reposition_order($1,'em_montagem','faltou montar')", [id]);
  expect(await row(id)).toMatchObject({ status: "em_montagem" });
  expect((await db.query("select * from steps where order_id=$1", [id])).rows.length).toBe(1);
});

it("recusa quem não é gestor, etapas fechadas, VTA sem armação e motivo vazio", async () => {
  const id = await make("pronto");
  await db.exec("set test.role='montador'");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','x x x')", [id])).rejects.toThrow("Apenas gestor");
  await db.exec("set test.role='admin'");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','')", [id])).rejects.toThrow("motivo");
  await expect(db.query("select reposition_order($1,'pronto','x x x')", [id])).rejects.toThrow("Escolha");
  const delivered = await make("entregue");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','x x x')", [delivered])).rejects.toThrow("não pode ser reposicionada");
  const vta = await make("aguardando_lentes", { frame_state: "vta" });
  await expect(db.query("select reposition_order($1,'aguardando_montagem','x x x')", [vta])).rejects.toThrow("armação");
  const same = await make("aguardando_montagem");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','x x x')", [same])).rejects.toThrow("já está");
  expect(await row(id)).toMatchObject({ status: "pronto" });
});
