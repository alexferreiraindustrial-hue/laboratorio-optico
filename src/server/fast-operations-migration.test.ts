import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const user = "00000000-0000-4000-8000-000000000001";
const migration = readFileSync(
  "supabase/migrations/20261123150000_fast_operations_client_followup.sql",
  "utf8",
);
async function row(id: string) {
  return (
    await db.query<Record<string, unknown>>(
      "select * from service_orders where id=$1",
      [id],
    )
  ).rows[0];
}
async function fresh() {
  const id = (
    await db.query<{ id: string }>(
      "insert into service_orders(client_name,laboratory_id,status) values('Teste isolado',$1,'aguardando_montagem') returning id",
      [user],
    )
  ).rows[0].id;
  await db.query(
    "select change_order_status($1,'em_montagem','Início real da montagem')",
    [id],
  );
  return id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(` create role anon;create role authenticated;create schema auth;create schema extensions;
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

 alter table service_orders add column delivered_at timestamptz,add column created_by uuid;
 create table assembly_steps(order_id uuid,status text,id uuid default gen_random_uuid(),step_key text,started_at timestamptz,completed_at timestamptz,assignee_id uuid,notes text,measurements jsonb,unique(order_id,step_key));
 create table assembly_step_history(step_id uuid,order_id uuid,action text,status text,notes text,reason text,user_id uuid);
 create table quality_occurrences(order_id uuid,status text);
 create function ensure_assembly_steps(uuid) returns void language sql as $$insert into assembly_steps(order_id,step_key,status) select $1,k,'pendente' from unnest(array['conferencia_inicial','lensometria','blocagem','facetadora','conferencia_qualidade']) k on conflict do nothing$$;
 create function next_os_number() returns text language sql as $$select 'TEST-'||gen_random_uuid()::text$$;
 create function assert_order_parties(uuid,uuid,uuid,uuid) returns void language sql as $$select$$;
 `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261122120000_vta_express_notices.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261123100000_medical_assistance.sql",
      "utf8",
    ),
  );
  const before = await row(user);
  await db.exec(migration);
  expect(await row(user)).toEqual(before);
  await db.exec(
    "create trigger orders_guard before insert or update on service_orders for each row execute function guard_order_controlled_fields()",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("migração é repetível e não altera serviços, etapas, locais ou senhas existentes", async () => {
  const before = (await db.query("select * from service_orders order by id"))
    .rows;
  const steps = (await db.query("select * from assembly_steps order by id"))
    .rows;
  await db.exec(migration);
  expect(
    (await db.query("select * from service_orders order by id")).rows,
  ).toEqual(before);
  expect(
    (await db.query("select * from assembly_steps order by id")).rows,
  ).toEqual(steps);
  expect(
    (
      await db.query<{ access_pin_hash: string }>(
        "select access_pin_hash from sellers where id=$1",
        [user],
      )
    ).rows[0].access_pin_hash,
  ).toBe("senha-original");
  expect(
    (await db.query("select * from client_delivery_followups")).rows,
  ).toHaveLength(0);
});
it("concluir montagem não exige nem inventa etapas realizadas; BO real continua bloqueando", async () => {
  const id = await fresh();
  await db.query("select ensure_assembly_steps($1)", [id]);
  await db.query("insert into quality_occurrences values($1,'aberta')", [id]);
  await expect(
    db.query("select change_order_status($1,'pronto','Montagem concluída')", [
      id,
    ]),
  ).rejects.toThrow("ocorrências");
  await db.query("delete from quality_occurrences where order_id=$1", [id]);
  await db.query(
    "select change_order_status($1,'pronto','Montagem concluída')",
    [id],
  );
  expect((await row(id)).status).toBe("pronto");
  expect(
    (
      await db.query<{ status: string }>(
        "select status from assembly_steps where order_id=$1",
        [id],
      )
    ).rows.every((r) => r.status === "pendente"),
  ).toBe(true);
});
it("facetadora concluída não encaminha ao médico automaticamente e correção exige motivo", async () => {
  const id = await fresh();
  await db.query("select ensure_assembly_steps($1)", [id]);
  await db.query(
    "update assembly_steps set status='concluida' where order_id=$1 and step_key='blocagem'",
    [id],
  );
  await db.query(
    "select advance_assembly_step($1,'facetadora','concluir','','{}','')",
    [id],
  );
  expect((await row(id)).status).toBe("em_montagem");
  await expect(
    db.query("select change_order_status($1,'em_correcao','')", [id]),
  ).rejects.toThrow("problema");
});
it("registro na lensometria é informativo por padrão; somente escolha explícita envia à correção", async () => {
  const id = await fresh();
  const before = await row(id);
  await db.query(
    "select register_order_stage_note($1,'lensometria','Registro sem dano na lente',false)",
    [id],
  );
  expect(await row(id)).toEqual(before);
  await db.query(
    "select register_order_stage_note($1,'lensometria','Problema impeditivo confirmado',true)",
    [id],
  );
  expect((await row(id)).status).toBe("em_correcao");
});
it("médico é decisão posterior ao pronto e continua impedindo entrega até o retorno", async () => {
  const id = await fresh();
  await db.query(
    "select change_order_status($1,'pronto','Montagem concluída')",
    [id],
  );
  const completed = (await row(id)).completed_at;
  await db.query(
    "select change_order_status($1,'em_conferencia','Encaminhado ao médico por decisão do operador')",
    [id],
  );
  expect(await row(id)).toMatchObject({
    status: "em_conferencia",
    medical_review_required: true,
    completed_at: completed,
  });
  await expect(
    db.query("select change_order_status($1,'pronto','tentar pular')", [id]),
  ).rejects.toThrow("liberação médica");
  await db.query(
    "select approve_medical_review($1,'Retorno do médico: liberado',$2)",
    [id, (await row(id)).updated_at],
  );
  expect((await row(id)).status).toBe("pronto");
});
it("cadastro já pronto é atômico, protegido e não conclui etapas fictícias", async () => {
  const payload = {
    p_client_name: "Registro de passagem pronto",
    p_laboratory_id: user,
    p_entered_at: new Date().toISOString(),
    p_service_description: "Serviço já pronto",
  };
  const result = await db.query<{ id: string }>(
    "select id from create_ready_service_order($1::jsonb,now()-interval '1 day')",
    [JSON.stringify(payload)],
  );
  const id = result.rows[0].id;
  expect((await row(id)).status).toBe("pronto");
  expect(
    (
      await db.query<{ status: string }>(
        "select status from assembly_steps where order_id=$1",
        [id],
      )
    ).rows.every((r) => r.status === "pendente"),
  ).toBe(true);
  await expect(
    db.query(
      "insert into service_orders(client_name,status) values('atalho indevido','pronto')",
    ),
  ).rejects.toThrow("Uma OS nova");
  const before = (await db.query("select id from service_orders")).rows.length;
  await expect(
    db.query(
      "select create_ready_service_order($1::jsonb,now()+interval '1 day')",
      [JSON.stringify(payload)],
    ),
  ).rejects.toThrow("futura");
  expect((await db.query("select id from service_orders")).rows.length).toBe(
    before,
  );
});
it("saída para a loja não inicia pós-venda; só confirmação do cliente cria cinco dias e não reinicia em duplicidade", async () => {
  const id = await fresh();
  await db.query("select change_order_status($1,'pronto','concluído')", [id]);
  await db.query("select change_order_status($1,'entregue','Saiu para loja')", [
    id,
  ]);
  expect(
    (
      await db.query(
        "select * from client_delivery_followups where order_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  const original = await row(id);
  await db.query(
    "select confirm_client_delivery($1,'(11) 00000-0000',now()-interval '6 days')",
    [id],
  );
  expect(await row(id)).toEqual(original);
  const d = (
    await db.query<{ id: string; gap: number; updated_at: string }>(
      "select id,extract(epoch from followup_due_at-client_delivered_at)::int gap,updated_at from client_delivery_followups where order_id=$1",
      [id],
    )
  ).rows[0];
  expect(d.gap).toBe(5 * 86400);
  await expect(
    db.query("select confirm_client_delivery($1,'11000000000',now())", [id]),
  ).rejects.toThrow("não será reiniciado");
  await db.query(
    "select update_client_followup($1,'adaptacao_ok','Cliente informou boa adaptação','11000000000',$2)",
    [d.id, d.updated_at],
  );
  expect(
    (
      await db.query<{ outcome: string }>(
        "select outcome from client_delivery_followups where id=$1",
        [d.id],
      )
    ).rows[0].outcome,
  ).toBe("adaptacao_ok");
  expect(await row(id)).toEqual(original);
});
it("perfis sem permissão não entregam ao cliente nem cadastram pronto", async () => {
  for (const role of ["", "consulta", "estoquista", "montador"]) {
    await db.query("select set_config('test.role',$1,false)", [role]);
    await expect(
      db.query("select confirm_client_delivery($1,'11000000000',now())", [
        user,
      ]),
    ).rejects.toThrow("Sem permissão");
    if (role !== "montador")
      await expect(
        db.query("select create_ready_service_order('{}',now())"),
      ).rejects.toThrow("Sem permissão");
  }
  await db.exec("set test.role='admin'");
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "select has_table_privilege('authenticated','client_delivery_followups','INSERT') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
});
