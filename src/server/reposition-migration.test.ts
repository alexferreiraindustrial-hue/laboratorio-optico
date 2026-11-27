import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const user = "00000000-0000-4000-8000-000000000001";
const row = async (id: string) => (await db.query<Record<string, unknown>>("select * from service_orders where id=$1", [id])).rows[0];
const history = async (id: string) => (await db.query<{ from_status: string; to_status: string; note: string }>("select from_status,to_status,note from order_status_history where order_id=$1", [id])).rows;
async function make(status: string, extra: { frame_state?: string; lens_arrived_at?: string | null; medical_review_required?: boolean } = {}) {
  await db.exec("set app.status_write='on'; set app.followup_write='on'");
  const id = (await db.query<{ id: string }>(
    "insert into service_orders(status,completed_at,lens_arrived_at,frame_state,medical_review_required,client_name) values($1,$2,$3,$4,$5,'Cliente') returning id",
    [status, status === "pronto" ? "2026-11-25T10:00:00Z" : null, extra.lens_arrived_at === undefined ? "2026-11-24T10:00:00Z" : extra.lens_arrived_at, extra.frame_state ?? "unknown", extra.medical_review_required ?? null],
  )).rows[0].id;
  await db.exec("set app.status_write='off'; set app.followup_write='off'");
  return id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
    create function public.current_app_role() returns text language sql as $$select nullif(current_setting('test.role',true),'')$$;
    set test.role='montador';
    create table service_orders(id uuid primary key default gen_random_uuid(), client_name text, status text not null, completed_at timestamptz, lens_arrived_at timestamptz,
      frame_state text check (frame_state in ('unknown','present','vta')), express_started_at timestamptz, medical_review_required boolean, medical_review_approved_at timestamptz,
      updated_by uuid, notes text default 'Não alterar');
    create table order_status_history(order_id uuid, from_status text, to_status text, note text, user_id uuid);
    create table steps(order_id uuid);
    create function public.ensure_assembly_steps(p uuid) returns void language sql as $$insert into steps values(p)$$;
    create function guard() returns trigger language plpgsql as $$begin
      if new.status is distinct from old.status and current_setting('app.status_write',true) is distinct from 'on' then raise exception 'Altere o status pela movimentação operacional.'; end if;
      if new.frame_state='vta' and new.status not in ('aguardando_lentes','cancelado') then raise exception 'VTA guard'; end if;
      if (new.medical_review_required is distinct from old.medical_review_required or new.medical_review_approved_at is distinct from old.medical_review_approved_at)
        and current_setting('app.followup_write',true) is distinct from 'on' then raise exception 'Use o acompanhamento.'; end if;
      if coalesce(new.medical_review_required,false) and new.medical_review_approved_at is null and new.status in ('pronto','entregue') then raise exception 'Aguardando liberação médica'; end if;
      return new; end$$;
    create trigger g before update on service_orders for each row execute function guard();
  `);
  await db.exec(readFileSync("supabase/migrations/20261126150000_reposition_order.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

it("desfaz o pronto para em montagem e registra o motivo", async () => {
  const id = await make("pronto");
  await db.query("select reposition_order($1,'em_montagem','dei pronto por engano')", [id]);
  expect(await row(id)).toMatchObject({ status: "em_montagem", completed_at: null, notes: "Não alterar" });
  expect(await history(id)).toEqual([{ from_status: "pronto", to_status: "em_montagem", note: "Pronto desfeito: dei pronto por engano" }]);
  expect((await db.query("select * from steps where order_id=$1", [id])).rows.length).toBe(1);
});

it("tira do médico e volta para a montagem sem travar o pronto depois", async () => {
  const id = await make("em_conferencia", { medical_review_required: true });
  await db.query("select reposition_order($1,'em_montagem','voltou do médico para ajustar')", [id]);
  expect(await row(id)).toMatchObject({ status: "em_montagem", medical_review_required: false });
  await db.query("select reposition_order($1,'pronto','montado')", [id]);
  expect(await row(id)).toMatchObject({ status: "pronto" });
});

it("achar na gaveta de prontos registra o retorno do médico", async () => {
  const id = await make("em_conferencia", { medical_review_required: true });
  await db.query("select reposition_order($1,'pronto','achei na gaveta')", [id]);
  const order = await row(id);
  expect(order).toMatchObject({ status: "pronto", medical_review_required: true });
  expect(order.medical_review_approved_at).toBeTruthy();
});

it("manda para o médico de qualquer etapa", async () => {
  const id = await make("pronto");
  await db.query("select reposition_order($1,'em_conferencia','foi para o médico')", [id]);
  expect(await row(id)).toMatchObject({ status: "em_conferencia", medical_review_required: true, medical_review_approved_at: null, completed_at: null });
});

it("aguardando lentes limpa a chegada e guarda a data antiga; VTA marca lente chegou", async () => {
  const id = await make("em_montagem");
  await db.query("select reposition_order($1,'aguardando_lentes','lente não chegou')", [id]);
  expect(await row(id)).toMatchObject({ status: "aguardando_lentes", lens_arrived_at: null });
  expect((await history(id))[0].note).toContain("chegada da lente registrada antes: 24/11/2026");
  await db.query("select reposition_order($1,'vta','cliente vai trazer a armação')", [id]);
  const vta = await row(id);
  expect(vta).toMatchObject({ status: "aguardando_lentes", frame_state: "vta" });
  expect(vta.lens_arrived_at).toBeTruthy();
  await db.query("select reposition_order($1,'em_montagem','armação chegou')", [id]);
  expect(await row(id)).toMatchObject({ status: "em_montagem", frame_state: "present" });
});

it("em correção também pode ser reposicionada", async () => {
  const id = await make("em_correcao");
  await db.query("select reposition_order($1,'pronto','corrigido')", [id]);
  expect(await row(id)).toMatchObject({ status: "pronto" });
});

it("recusa perfil sem acesso, entregue, motivo vazio e mesma posição", async () => {
  const id = await make("pronto");
  await db.exec("set test.role='consulta'");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','x x x')", [id])).rejects.toThrow("acesso");
  await db.exec("set test.role='montador'");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','')", [id])).rejects.toThrow("motivo");
  await expect(db.query("select reposition_order($1,'entregue','x x x')", [id])).rejects.toThrow("desconhecida");
  await expect(db.query("select reposition_order($1,'pronto','x x x')", [id])).rejects.toThrow("já está");
  const delivered = await make("entregue");
  await expect(db.query("select reposition_order($1,'aguardando_montagem','x x x')", [delivered])).rejects.toThrow("entregue ou cancelada");
  expect(await row(id)).toMatchObject({ status: "pronto" });
});
