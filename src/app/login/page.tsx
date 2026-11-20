"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Layers3, ScanLine } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { LensMark } from "@/components/lens";
import { Button, Feedback, Field, Input } from "@/components/ui";
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
        setError(null);
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
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#f7f6f3] p-12 text-[#222222] lg:flex xl:p-16">
        <div className="flex items-center gap-3"><LensMark size={38} /><div><p className="text-xl font-bold tracking-tight">Lab <span className="font-normal text-[#8c6239]">Gold</span></p><p className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-[#8c6239]">DO PEDIDO À RETIRADA</p></div></div>
        <div className="relative z-10 my-14 max-w-lg">
          <span className="rounded-full border border-[#e2ddd5] px-3 py-1.5 text-xs text-[#6e6a63]">Seu laboratório, em movimento</span>
          <h1 className="mt-7 text-5xl font-semibold leading-[1.12] xl:text-6xl">Cada OS no lugar.<br /><span className="text-[#8c6239]">Cada etapa no tempo.</span></h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-[#6e6a63]">Uma operação conectada para acompanhar lentes, organizar a bancada e entregar com confiança.</p>
          <div className="mt-10 grid grid-cols-3 gap-3 border-t border-[#e2ddd5] pt-6">
            {[[ScanLine, "Entrada ágil"], [Layers3, "Produção visível"], [CheckCircle2, "Qualidade rastreável"]].map(([Icon, label], i) => { const Mark = Icon as typeof ScanLine; return <div key={i}><Mark size={21} className="mb-3 text-[#8c6239]" /><p className="text-xs font-medium text-[#222222]">{label as string}</p></div>; })}
          </div>
        </div>
        <p className="text-xs text-[#6e6a63]">Lab Gold · Gestão da produção óptica</p>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><LensMark size={36} /><p className="text-xl font-bold">Lab <span className="font-normal text-[var(--accent)]">Gold</span></p></div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Acesso da equipe</p>
          <h1 className="mt-3 text-3xl font-bold">Vamos à produção.</h1>
          <p className="mb-8 mt-3 text-sm leading-relaxed text-[var(--muted)]">Entre para acompanhar as ordens de serviço e continuar o trabalho do laboratório.</p>
          <div className="mb-5"><Link href="/vendedor/login" className="flex items-center justify-between rounded-xl bg-[var(--background)] p-4 text-sm font-semibold text-[var(--accent)]"><span>Sou vendedor · entrar e acompanhar OS<span className="mt-1 block text-xs font-normal text-[var(--muted)]">Acesse com seu código e senha</span></span><ArrowRight size={18} /></Link></div>
          <Suspense fallback={<p role="status">Preparando acesso…</p>}><LoginForm /></Suspense>
          <div className="mt-8 border-t border-[var(--line)] pt-6">

            <p className="mt-6 text-center text-xs text-[var(--muted)]">Primeiro acesso? <Link href="/acesso-inicial" className="font-semibold text-[var(--accent)] hover:underline">Configurar laboratório</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
