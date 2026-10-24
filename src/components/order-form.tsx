"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toDateTimeLocalValue } from "@/lib/format";
import { sellersForStore } from "@/lib/domain/portal";
import type { Laboratory, OrderRow, Seller, SellerStoreLink, Store } from "@/lib/types";
import { saveOrder } from "@/server/actions";
import { saveSeller, saveStore } from "@/server/parties";
import { Button, Feedback, Field, Input, Select, TextArea } from "./ui";

export function OrderForm({
  laboratories,
  sellers,
  stores = [],
  sellerLinks = [],
  order,
}: {
  laboratories: Laboratory[];
  sellers: Seller[];
  stores?: Store[];
  sellerLinks?: SellerStoreLink[];
  order?: OrderRow;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [storeId, setStoreId] = useState(order?.store_id ?? "");
  const [storeOptions, setStoreOptions] = useState(stores);
  const [sellerOptions, setSellerOptions] = useState(sellers);
  const [links, setLinks] = useState(sellerLinks);
  const [sellerId, setSellerId] = useState(order?.seller_id ?? "");
  const [draftOpen, setDraftOpen] = useState<"seller" | "store" | null>(null);
  const visibleSellers = storeId
    ? sellersForStore(sellerOptions.filter((seller) => seller.active || seller.id === order?.seller_id), links, storeId)
    : sellerOptions.filter((seller) => seller.active || seller.id === order?.seller_id);
  const spec = order?.lens_spec ?? {};

  if (laboratories.length === 0) {
    return (
      <p className="text-sm text-[#6e7c7a]">
        Cadastre um laboratório em Configurações antes de abrir uma OS.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveOrder(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "OS salva.");
          if (!order && result.id) router.push(`/laboratorio/${result.id}`);
          else router.refresh();
        });
      }}
    >
      {order ? <input type="hidden" name="id" value={order.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Cliente ou loja">
          <Input name="clientName" required defaultValue={order?.client_name} />
        </Field>
        <Field label="Loja">
          <Select name="storeId" value={storeId} onChange={(event) => { setStoreId(event.target.value); setSellerId(""); }}>
            <option value="">Não informada</option>
            {storeOptions.filter((store) => store.active || store.id === order?.store_id).map((store) => (
              <option key={store.id} value={store.id}>{store.trade_name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Vendedor">
          <Select name="sellerId" value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
            <option value="">Não informado</option>
            {visibleSellers.map((seller) => (
              <option key={seller.id} value={seller.id}>{seller.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Laboratório">
          <Select name="laboratoryId" required defaultValue={order?.laboratory_id}>
            {laboratories.filter((lab) => lab.active || lab.id === order?.laboratory_id).map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select name="priority" defaultValue={order?.priority ?? "normal"}>
            <option value="normal">Normal</option>
            <option value="critica">Crítica</option>
          </Select>
        </Field>
        <Field label="Entrada">
          <Input
            type="datetime-local"
            name="enteredAt"
            required
            defaultValue={order ? toDateTimeLocalValue(order.entered_at) : toDateTimeLocalValue(new Date().toISOString())}
          />
        </Field>
        <Field label="Previsão de conclusão">
          <Input type="datetime-local" name="dueAt" defaultValue={toDateTimeLocalValue(order?.due_at)} />
        </Field>
        {!order ? (
          <Field label="Situação inicial">
            <Select name="status" defaultValue="aguardando_lentes">
              <option value="aguardando_lentes">Aguardando lentes</option>
              <option value="aguardando_montagem">Aguardando montagem</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="status" value="aguardando_lentes" />
        )}
        <Field label="Pedido externo">
          <Input name="externalOrderId" defaultValue={order?.external_order_id ?? ""} />
        </Field>
      </div>
      <Field label="Descrição do serviço">
        <TextArea name="serviceDescription" required defaultValue={order?.service_description} />
      </Field>
      <Field label="Observações">
        <TextArea name="notes" defaultValue={order?.notes ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Esférico OD"><Input name="odSphere" defaultValue={spec.od_sphere} placeholder="-2,00" /></Field>
        <Field label="Cilíndrico OD"><Input name="odCylinder" defaultValue={spec.od_cylinder} placeholder="-0,75" /></Field>
        <Field label="Eixo OD"><Input name="odAxis" defaultValue={spec.od_axis} /></Field>
        <Field label="Adição"><Input name="addition" defaultValue={spec.addition} /></Field>
        <Field label="Esférico OE"><Input name="oeSphere" defaultValue={spec.oe_sphere} /></Field>
        <Field label="Cilíndrico OE"><Input name="oeCylinder" defaultValue={spec.oe_cylinder} /></Field>
        <Field label="Eixo OE"><Input name="oeAxis" defaultValue={spec.oe_axis} /></Field>
        <Field label="Armação"><Input name="frame" defaultValue={spec.frame} /></Field>
      </div>
      <Field label="Observação das lentes">
        <Input name="lensNotes" defaultValue={spec.lens_notes} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : order ? "Salvar alterações" : "Abrir OS"}</Button>
        <Button type="button" variant="secondary" onClick={() => setDraftOpen("store")}>Cadastrar loja</Button>
        <Button type="button" variant="secondary" onClick={() => setDraftOpen("seller")}>Cadastrar vendedor</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
      {draftOpen ? (
        <QuickParty
          kind={draftOpen}
          stores={storeOptions}
          onClose={() => setDraftOpen(null)}
          onStore={(store) => {
            setStoreOptions((current) => [...current, store]);
            setStoreId(store.id);
            setDraftOpen(null);
          }}
          onSeller={(seller, storeIds) => {
            setSellerOptions((current) => [...current, seller]);
            setLinks((current) => [...current, ...storeIds.map((id) => ({ seller_id: seller.id, store_id: id }))]);
            setSellerId(seller.id);
            setDraftOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

function QuickParty({
  kind,
  stores,
  onClose,
  onStore,
  onSeller,
}: {
  kind: "store" | "seller";
  stores: Store[];
  onClose: () => void;
  onStore: (store: Store) => void;
  onSeller: (seller: Seller, storeIds: string[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="rounded-md border border-[#e2e7e9] bg-[#f7f9f9] p-3">
      <p className="mb-2 text-sm font-medium">{kind === "store" ? "Nova loja" : "Novo vendedor"}</p>
      <form
        className="grid gap-2 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            if (kind === "store") {
              const result = await saveStore(formData);
              if (!result.ok || !result.id) {
                setError(result.ok ? "Não foi possível cadastrar a loja." : result.message);
                return;
              }
              onStore({
                id: result.id,
                public_code: "",
                trade_name: String(formData.get("tradeName") ?? ""),
                legal_name: null,
                cnpj: null,
                contact_name: null,
                phone: null,
                whatsapp: null,
                email: null,
                address: null,
                notes: null,
                active: true,
              });
              return;
            }
            const result = await saveSeller(formData);
            if (!result.ok || !result.id) {
              setError(result.ok ? "Não foi possível cadastrar o vendedor." : result.message);
              return;
            }
            onSeller(
              { id: result.id, name: String(formData.get("name") ?? ""), active: true, notes: null },
              formData.getAll("storeId").map(String),
            );
          });
        }}
      >
        {kind === "store" ? (
          <Field label="Nome fantasia"><Input name="tradeName" required /></Field>
        ) : (
          <>
            <Field label="Nome completo"><Input name="name" required /></Field>
            <Field label="Loja">
              <Select name="storeId" defaultValue="">
                <option value="">Sem loja</option>
                {stores.filter((store) => store.active).map((store) => (
                  <option key={store.id} value={store.id}>{store.trade_name}</option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar e usar"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Feedback error={error} />
        </div>
      </form>
    </div>
  );
}
