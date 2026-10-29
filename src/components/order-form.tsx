"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toDateTimeLocalValue } from "@/lib/format";
import { sellersForStore } from "@/lib/domain/portal";
import type { Laboratory, OrderRow, Seller, SellerStoreLink, Store } from "@/lib/types";
import { saveOrder } from "@/server/actions";
import { saveSeller, saveStore } from "@/server/parties";
import { Button, Feedback, Field, Input, Select, TextArea } from "./ui";

/** Calcula prazo automático: simples = 3 dias úteis, multifocal = 5 dias corridos */
function calcDueAt(lensType: "simples" | "multifocal"): string {
  const d = new Date();
  d.setDate(d.getDate() + (lensType === "simples" ? 3 : 5));
  // Ajusta para fim do dia
  d.setHours(17, 0, 0, 0);
  return toDateTimeLocalValue(d.toISOString());
}

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
  const [lensType, setLensType] = useState<"simples" | "multifocal">("simples");
  const [dueAt, setDueAt] = useState<string>(order ? toDateTimeLocalValue(order.due_at) : calcDueAt("simples"));
  const [showReceita, setShowReceita] = useState(false);

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
        className="grid gap-5"
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

        {/* Bloco 1: Tipo de lente — define o prazo automaticamente */}
        {!order ? (
          <div className="rounded-lg border border-[#cdd5d8] bg-[#f7f9f9] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6e7c7a]">Tipo de lente</p>
            <div className="flex gap-3">
              {(["simples", "multifocal"] as const).map((tipo) => (
                <label
                  key={tipo}
                  className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 px-4 py-3 transition-colors ${
                    lensType === tipo
                      ? "border-[#0e6b62] bg-white"
                      : "border-[#e2e7e9] bg-white hover:border-[#b4c4c2]"
                  }`}
                >
                  <input
                    type="radio"
                    name="lensType"
                    value={tipo}
                    checked={lensType === tipo}
                    onChange={() => {
                      setLensType(tipo);
                      setDueAt(calcDueAt(tipo));
                    }}
                    className="accent-[#0e6b62]"
                  />
                  <div>
                    <p className="font-semibold capitalize">{tipo}</p>
                    <p className="text-xs text-[#6e7c7a]">{tipo === "simples" ? "Prazo: 3 dias" : "Prazo: 5 dias"}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {/* Bloco 2: Dados principais */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do cliente">
            <Input name="clientName" required defaultValue={order?.client_name} placeholder="Ex.: João Silva" />
          </Field>
          <Field label="Vendedor">
            <Select name="sellerId" value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
              <option value="">Não informado</option>
              {visibleSellers.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Loja">
            <Select name="storeId" value={storeId} onChange={(event) => { setStoreId(event.target.value); setSellerId(""); }}>
              <option value="">Não informada</option>
              {storeOptions.filter((store) => store.active || store.id === order?.store_id).map((store) => (
                <option key={store.id} value={store.id}>{store.trade_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Laboratório">
            <Select name="laboratoryId" required defaultValue={order?.laboratory_id}>
              {laboratories.filter((lab) => lab.active || lab.id === order?.laboratory_id).map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
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
          <Field label={`Previsão de entrega${!order ? ` (${lensType === "simples" ? "3 dias" : "5 dias"})` : ""}`}>
            <Input
              type="datetime-local"
              name="dueAt"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
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
          <Field label="Prioridade">
            <Select name="priority" defaultValue={order?.priority ?? "normal"}>
              <option value="normal">Normal</option>
              <option value="critica">⚠ Crítica</option>
            </Select>
          </Field>
        </div>

        {/* Bloco 3: Descrição do serviço */}
        <Field label="Descrição do serviço">
          <TextArea name="serviceDescription" required defaultValue={order?.service_description} placeholder="Ex.: Lentes multifocal progressiva com antirreflexo..." />
        </Field>

        {/* Bloco 4: Receita (expansível) */}
        <div className="rounded-lg border border-[#e2e7e9]">
          <button
            type="button"
            onClick={() => setShowReceita((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[#44524f] hover:bg-[#f7f9f9]"
          >
            <span>📋 Dados da receita (opcional)</span>
            <span className="text-xs font-normal text-[#6e7c7a]">{showReceita ? "▲ Fechar" : "▼ Abrir"}</span>
          </button>
          {showReceita ? (
            <div className="grid gap-3 border-t border-[#e2e7e9] p-4 sm:grid-cols-4">
              <Field label="Esférico OD"><Input name="odSphere" defaultValue={spec.od_sphere} placeholder="-2,00" /></Field>
              <Field label="Cilíndrico OD"><Input name="odCylinder" defaultValue={spec.od_cylinder} placeholder="-0,75" /></Field>
              <Field label="Eixo OD"><Input name="odAxis" defaultValue={spec.od_axis} /></Field>
              <Field label="Adição"><Input name="addition" defaultValue={spec.addition} /></Field>
              <Field label="Esférico OE"><Input name="oeSphere" defaultValue={spec.oe_sphere} /></Field>
              <Field label="Cilíndrico OE"><Input name="oeCylinder" defaultValue={spec.oe_cylinder} /></Field>
              <Field label="Eixo OE"><Input name="oeAxis" defaultValue={spec.oe_axis} /></Field>
              <Field label="Armação"><Input name="frame" defaultValue={spec.frame} /></Field>
              <div className="sm:col-span-4">
                <Field label="Observação das lentes">
                  <Input name="lensNotes" defaultValue={spec.lens_notes} />
                </Field>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bloco 5: Observações gerais */}
        <Field label="Observações gerais (opcional)">
          <TextArea name="notes" defaultValue={order?.notes ?? ""} placeholder="Qualquer detalhe adicional..." />
        </Field>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : order ? "Salvar alterações" : "Abrir OS"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setDraftOpen("store")}>+ Loja</Button>
          <Button type="button" variant="secondary" onClick={() => setDraftOpen("seller")}>+ Vendedor</Button>
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
