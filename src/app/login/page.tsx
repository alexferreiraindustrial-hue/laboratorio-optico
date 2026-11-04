"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { LensMark } from "@/components/lens";
import { Button, Feedback, Field, Input, Panel } from "@/components/ui";
import { signIn } from "@/server/actions";

function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("inativo") ? "Este usuário está inativo." : null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await signIn(formData);
          if (result && !result.ok) setError(result.message);
        });
      }}
    >
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar no laboratório"}
      </Button>
      <Feedback error={error} />
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mb-8 flex items-center gap-3">
        <LensMark size={40} />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)]">OTICAHUB LAB</p>
          <h1 className="text-[34px]">Acesso operacional</h1>
        </div>
      </div>
      <Panel className="p-5 md:p-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </Panel>
      <p className="mt-5 text-sm text-[var(--muted)]">
        Vendedor acompanhando OS?{" "}
        <Link className="font-semibold text-[var(--accent)] underline decoration-[var(--accent-soft)] underline-offset-4" href="/acompanhar">
          Entrar com código e PIN
        </Link>
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Primeiro acesso do laboratório?{" "}
        <Link className="font-semibold text-[var(--accent)] underline decoration-[var(--accent-soft)] underline-offset-4" href="/acesso-inicial">
          Criar administrador
        </Link>
      </p>
    </main>
  );
}
