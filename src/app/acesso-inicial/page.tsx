"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Feedback, Field, Input, Panel } from "@/components/ui";
import { createFirstAdmin } from "@/server/actions";

export default function FirstAccessPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Criar o administrador</h1>
      <p className="mt-2 text-sm text-[#6e7c7a]">
        Esta tela só funciona enquanto não existir nenhum usuário. A primeira conta recebe o perfil de administrador.
      </p>
      <Panel className="mt-5 p-4">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createFirstAdmin(formData);
              if (!result.ok) {
                setMessage(null);
                setError(result.message);
                return;
              }
              setError(null);
              setMessage(result.message ?? "Administrador criado.");
            });
          }}
        >
          <Field label="Nome"><Input name="fullName" required /></Field>
          <Field label="E-mail"><Input name="email" type="email" required /></Field>
          <Field label="Senha"><Input name="password" type="password" minLength={8} required /></Field>
          <Button type="submit" disabled={pending}>{pending ? "Criando..." : "Criar administrador"}</Button>
          <Feedback error={error} message={message} />
        </form>
      </Panel>
      <Link className="mt-4 text-sm text-[#0e6b62] underline" href="/login">Voltar ao acesso</Link>
    </main>
  );
}
