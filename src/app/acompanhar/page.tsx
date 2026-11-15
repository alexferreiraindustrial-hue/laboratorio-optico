"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Field, Input, Panel } from "@/components/ui";
import { submitSellerAppLogin } from "@/server/portal-actions";

function parsePortalInput(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("acompanhar");
    if (i >= 0 && parts[i + 1] && parts[i + 2]) {
      const kind = parts[i + 1];
      const token = parts[i + 2];
      if ((kind === "vendedor" || kind === "loja") && token) return { kind, token };
    }
  } catch {
    /* paste token only */
  }
  if (/^[A-Za-z0-9_-]{20,}$/.test(value)) return { kind: "vendedor", token: value };
  return null;
}

export default function PortalGatePage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
      <p className="text-sm font-medium text-[#087e83]">Acompanhamento</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight">Serviços do vendedor</h1>
      <p className="mt-2 text-sm text-[#60767b]">
        O laboratório cria o seu cadastro e o PIN. Você vê só as suas OS — prontas, em produção e encerradas.
      </p>
      <Panel className="mt-5 grid gap-3 p-4">
        <Field label="Código rápido ou e-mail" hint="Exemplo: v3">
          <Input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" placeholder="v3" />
        </Field>
        <Field label="PIN">
          <Input
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            autoComplete="current-password"
            type="password"
            placeholder="4 a 8 dígitos"
          />
        </Field>
        {error ? <p className="text-sm text-[#a3261b]">{error}</p> : null}
        <Button
          type="button"
          className="w-full"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const formData = new FormData();
              formData.set("login", login);
              formData.set("pin", pin);
              const result = await submitSellerAppLogin(formData);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setError(null);
              router.push(`/acompanhar/${result.kind}/${result.token}`);
            });
          }}
        >
          {pending ? "Entrando..." : "Ver meus serviços"}
        </Button>
      </Panel>
      <details className="mt-4 rounded-2xl border border-[#dce5e7] bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#087e83]">Já tenho o link do PWA</summary>
        <div className="mt-3 grid gap-3">
          <Field label="Cole o link">
            <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://lab.oticahub.com/acompanhar/vendedor/…" />
          </Field>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const parsed = parsePortalInput(link);
              if (!parsed) {
                setError("Cole o link completo que o laboratório enviou.");
                return;
              }
              setError(null);
              router.push(`/acompanhar/${parsed.kind}/${parsed.token}`);
            }}
          >
            Abrir pelo link
          </Button>
        </div>
      </details>
      <p className="mt-4 text-sm text-[#60767b]">
        Equipe do laboratório? <Link className="text-[#087e83] underline" href="/login">Entrar no sistema</Link>
      </p>
    </main>
  );
}
