"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issuePortalLink, revokePortalLink, saveSeller, saveStore, setSellerAppAccess } from "@/server/parties";
import { whatsappLink } from "@/lib/domain/forecast";
import type { Store } from "@/lib/types";
import { Button, Feedback, Field, Input, Select, TextArea } from "./ui";

export function StoreForm({ store }: { store?: Store }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveStore(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Loja salva.");
          if (!store && result.id) router.push(`/lojas/${result.id}`);
          else router.refresh();
        });
      }}
    >
      {store ? <input type="hidden" name="id" value={store.id} /> : null}
      <Field label="Nome fantasia"><Input name="tradeName" required defaultValue={store?.trade_name} /></Field>
      <Field label="Código rápido" hint="Número usado no lançamento: digite l1, l2… para trocar de loja">
        <Input name="quickCode" inputMode="numeric" defaultValue={store?.quick_code ?? ""} placeholder="automático" />
      </Field>
      <Field label="Razão social"><Input name="legalName" defaultValue={store?.legal_name ?? ""} /></Field>
      <Field label="CNPJ"><Input name="cnpj" defaultValue={store?.cnpj ?? ""} placeholder="Somente números" /></Field>
      <Field label="Responsável"><Input name="contactName" defaultValue={store?.contact_name ?? ""} /></Field>
      <Field label="Telefone"><Input name="phone" defaultValue={store?.phone ?? ""} /></Field>
      <Field label="WhatsApp"><Input name="whatsapp" defaultValue={store?.whatsapp ?? ""} /></Field>
      <Field label="E-mail"><Input name="email" type="email" defaultValue={store?.email ?? ""} /></Field>
      <Field label="Situação">
        <Select name="active" defaultValue={store?.active === false ? "false" : "true"}>
          <option value="true">Ativa</option>
          <option value="false">Inativa</option>
        </Select>
      </Field>
      <Field label="Endereço"><Input name="address" defaultValue={store?.address ?? ""} className="md:col-span-2" /></Field>
      <Field label="Observações internas"><TextArea name="notes" defaultValue={store?.notes ?? ""} /></Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar loja"}</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

export function SellerForm({
  seller,
  stores,
  selected,
}: {
  seller?: { id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null; notes: string | null; active: boolean; quick_code?: number | null };
  stores: { id: string; trade_name: string }[];
  selected: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveSeller(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Vendedor salvo.");
          if (!seller && result.id) router.push(`/vendedores/${result.id}`);
          else router.refresh();
        });
      }}
    >
      {seller ? <input type="hidden" name="id" value={seller.id} /> : null}
      <Field label="Nome completo"><Input name="name" required defaultValue={seller?.name} /></Field>
      <Field label="Código rápido" hint="Número usado no lançamento: digite v1, v2… para trocar de vendedor">
        <Input name="quickCode" inputMode="numeric" defaultValue={seller?.quick_code ?? ""} placeholder="automático" />
      </Field>
      <Field label="Telefone"><Input name="phone" defaultValue={seller?.phone ?? ""} /></Field>
      <Field label="WhatsApp"><Input name="whatsapp" defaultValue={seller?.whatsapp ?? ""} /></Field>
      <Field label="E-mail"><Input name="email" type="email" defaultValue={seller?.email ?? ""} /></Field>
      <Field label="Situação">
        <Select name="active" defaultValue={seller?.active === false ? "false" : "true"}>
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </Select>
      </Field>
      <fieldset className="grid gap-2 md:col-span-2">
        <legend className="text-sm font-medium">Lojas vinculadas</legend>
        {stores.length === 0 ? <p className="text-sm text-[var(--muted)]">Cadastre uma loja antes de vincular.</p> : null}
        {stores.map((store) => (
          <label key={store.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="storeId" value={store.id} defaultChecked={selected.includes(store.id)} />
            {store.trade_name}
          </label>
        ))}
        {stores.length ? <input type="hidden" name="storeId" value="" /> : <input type="hidden" name="storeId" value="" />}
      </fieldset>
      <Field label="Observações internas"><TextArea name="notes" defaultValue={seller?.notes ?? ""} /></Field>
      <Field
        label="Senha do vendedor"
        hint="Você cria o acesso. O vendedor entra no site e no app com o código rápido (v3) e esta senha. Só vê as OS dele. Deixe em branco para não alterar."
      >
        <Input name="appPin" type="password" minLength={4} maxLength={64} autoComplete="new-password" placeholder="••••" />
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar vendedor"}</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

export function SellerAppAccess({ sellerId, login, sellerName }: { sellerId: string; login: string; sellerName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [password,setPassword]=useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await setSellerAppAccess(formData);
          if (!result.ok) {
            setMessage(null);
            setError(result.message);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Acesso criado.");
          form.reset();
          setPassword("");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="sellerId" value={sellerId} />
      <p className="text-sm text-[var(--muted)]">
        Entrada pelo nome <strong className="text-[var(--ink)]">{sellerName}</strong> ou pelo código <strong className="text-[var(--ink)]">{login}</strong>. Defina ou altere a senha com pelo menos 4 caracteres (letras, números e símbolos) e entregue só para este vendedor. Ele acompanha apenas as OS dele. No site, use lab.oticahub.com/vendedor/login; no app, escolha Vendedor.
      </p>
      <Field label="Definir ou alterar senha">
        <Input name="appPin" value={password} onChange={event=>setPassword(event.target.value)} type="password" minLength={4} maxLength={64} autoComplete="new-password" required placeholder="Digite a nova senha" />
      </Field>
      <Button type="button" variant="secondary" disabled={pending||sellerName.trim().length<4} onClick={()=>setPassword(sellerName.trim())}>Preencher senha com o nome · salvar abaixo</Button>
      <p className="text-xs text-[var(--muted)]">A senha atual só muda quando você clicar em Salvar senha. Nenhuma vendedora será alterada automaticamente.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar senha do vendedor"}</Button>
        <Feedback error={error} message={message} />
      </div>
    </form>
  );
}

export function LinkManager({
  subjectType,
  subjectId,
  credentials,
  phone = null,
  name = null,
}: {
  phone?: string | null;
  name?: string | null;
  subjectType: "store" | "seller";
  subjectId: string;
  credentials: { id: string; token_prefix: string; revoked_at: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const path = subjectType === "store" ? "loja" : "vendedor";
  const active = credentials.find((item) => !item.revoked_at);
  const share = token
    ? whatsappLink(
        phone,
        `Olá${name ? `, ${name.split(" ")[0]}` : ""}! Este é o seu link para acompanhar em tempo real os serviços no laboratório (progresso, previsão e recados): ${window.location.origin}/acompanhar/${path}/${token}`,
      )
    : null;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-[var(--muted)]">
        Link opcional do PWA. O acesso principal do vendedor no app é a senha que você cria no cadastro. O sistema guarda só o hash do link.
        {active ? ` Prefixo do link ativo: ${active.token_prefix}…` : " Nenhum link ativo."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await issuePortalLink(subjectType, subjectId);
              if (!result.ok || !result.token) {
                setToken(null);
                setError(result.ok ? "Não foi possível gerar o link." : result.message);
                return;
              }
              setError(null);
              setToken(result.token);
              router.refresh();
            });
          }}
        >
          {active ? "Renovar link" : "Gerar link"}
        </Button>
        {active ? (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await revokePortalLink(active.id);
                if (!result.ok) setError(result.message);
                else {
                  setToken(null);
                  setError(null);
                  router.refresh();
                }
              });
            }}
          >
            Revogar
          </Button>
        ) : null}
      </div>
      {token ? (
        <div className="grid gap-2">
          <Input readOnly value={`${window.location.origin}/acompanhar/${path}/${token}`} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/acompanhar/${path}/${token}`)}
            >
              Copiar link
            </Button>
            {share ? (
              <a
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--bg-2e7d5b)] px-3.5 text-sm font-semibold text-white hover:bg-[var(--bg-2e7d5b)]"
                target="_blank"
                rel="noreferrer"
                href={share}
              >
                Enviar pelo WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <Feedback error={error} message={token ? "Link gerado. Copie agora; ele não será mostrado de novo." : null} />
    </div>
  );
}
