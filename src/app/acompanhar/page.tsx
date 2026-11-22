"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Field, Input, Panel } from "@/components/ui";
import { sellerSignIn } from "@/server/seller-actions";

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
      <p className="text-sm font-medium text-[var(--link)]">Acompanhamento</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight">Serviços do vendedor</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        O laboratório cria o seu cadastro e a senha. Você vê só as suas OS — prontas, em produção e encerradas.
      </p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setError(null);
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const result = await sellerSignIn(data);
            if (!result.ok) { setError(result.message); return; }
            setPin("");
            router.replace("/vendedor");
          } catch { setError("Não foi possível entrar agora. Confira a conexão e tente novamente."); }
        });
      }}>
      <Panel className="mt-5 grid gap-4 p-5">
        <Field label="Nome ou código da vendedora" hint="Use seu nome completo cadastrado ou o código entregue pelo laboratório.">
          <Input name="login" required value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" placeholder="Seu nome completo ou v3" disabled={pending} />
        </Field>
        <Field label="Senha do vendedor">
          <Input name="pin" required minLength={4} maxLength={64} value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="current-password" type="password" placeholder="Sua senha" disabled={pending} />
        </Field>
        {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" className="min-h-12 w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar · ver meus serviços"}</Button>
        <p className="text-xs leading-relaxed text-[var(--muted)]">Seu acesso é exclusivo para acompanhar as suas OS. O mesmo nome/código e senha funcionam na opção Vendedor do app.</p>
      </Panel>
      </form>
      <details className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--link)]">Entrar com meu link de acompanhamento</summary>
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
                setError("Cole o link completo de acompanhamento que o laboratório enviou.");
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
      <p className="mt-4 text-sm text-[var(--muted)]">
        Não recebeu código e senha? Peça ao laboratório.
        Equipe do laboratório? <Link className="text-[var(--link)] underline" href="/login">Entrar no sistema</Link>
      </p>
    </main>
  );
}
