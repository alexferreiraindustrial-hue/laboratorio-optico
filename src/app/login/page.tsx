"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { Button, Feedback, Field, Input, Panel } from "@/components/ui";
import { signIn } from "@/server/actions";

function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("inativo") ? "Este usuário está inativo." : null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
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
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
      <Feedback error={error} />
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-sm font-medium text-[#0e6b62]">Laboratório Óptico</p>
      <h1 className="mt-1 text-2xl font-semibold">Acesso operacional</h1>
      <Panel className="mt-5 p-4">
        <Suspense>
          <LoginForm />
        </Suspense>
      </Panel>
      <p className="mt-4 text-sm text-[#6e7c7a]">
        Primeiro acesso do laboratório? <Link className="text-[#0e6b62] underline" href="/acesso-inicial">Criar administrador</Link>
      </p>
    </main>
  );
}
