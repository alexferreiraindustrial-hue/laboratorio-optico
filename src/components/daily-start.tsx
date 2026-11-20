import Link from "next/link";
import { ArrowRight, ClipboardList, PackageCheck, PackageOpen, Plus, Wrench } from "lucide-react";
import { can } from "@/lib/domain/permissions";
import type { AppRole } from "@/lib/domain/constants";

export function DailyStart({ name, role, waiting, assembly, ready, late, failed }: { name: string; role: AppRole; waiting: number; assembly: number; ready: number; late: number; failed: boolean }) {
  const tasks = [
    { title: "Cadastrar uma OS", hint: "Recebeu um serviço? Informe vendedor, número e prazo.", href: "/laboratorio/rapido", icon: Plus, count: null, allowed: can(role, "orders.write") },
    { title: "As lentes chegaram", hint: "Localize a OS e confirme o recebimento das lentes.", href: "/laboratorio/rapido?modo=lentes", icon: PackageOpen, count: waiting, allowed: can(role, "orders.status") },
    { title: "Fazer a montagem", hint: "Abra o cartão e use o botão da próxima etapa.", href: "/montagem", icon: Wrench, count: assembly, allowed: can(role, "assembly.write") },
    { title: "Entregar um serviço", hint: "Confirme quem retirou. Somente OS prontas podem sair.", href: "/laboratorio/rapido?modo=saida", icon: PackageCheck, count: ready, allowed: can(role, "orders.deliver") },
  ].filter((task) => task.allowed);
  return <div className="mx-auto grid w-full max-w-5xl gap-5">
    <header><p className="mb-1 text-sm font-semibold text-[#087e83]">Olá, {name.split(" ")[0]}.</p><h1 className="text-3xl font-bold tracking-tight">O que você precisa fazer?</h1><p className="mt-2 text-base text-[#60767b]">Escolha uma tarefa. O sistema orienta o próximo passo.</p></header>
    {failed ? <p role="alert" className="rounded-xl border border-[#f1c4be] bg-[#fdecea] p-4 text-[#a3261b]">Não foi possível carregar todos os números agora. Atualize a página antes de conferir a fila.</p> : late > 0 ? <Link href="/laboratorio?tab=atrasadas" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#f1c4be] bg-[#fdecea] p-4 font-semibold text-[#a3261b]"><span>{late} serviço(s) com prazo vencido · conferir primeiro</span><ArrowRight size={20} className="shrink-0" /></Link> : null}
    <div className="grid gap-3 sm:grid-cols-2">{tasks.map((task, index) => <Link key={task.href} href={task.href} className="group flex min-h-40 items-start gap-4 rounded-2xl border border-[#dce5e7] bg-white p-5 hover:border-[#087e83] focus-visible:outline-2 focus-visible:outline-[#087e83]">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e5f4f3] text-[#087e83]"><task.icon size={24} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-[#60767b]">Passo {index + 1}</p><h2 className="mt-1 text-xl font-bold">{task.title}</h2><p className="mt-2 text-sm leading-relaxed text-[#60767b]">{task.hint}</p>{task.count !== null && !failed ? <p className="mt-3 text-sm font-semibold text-[#087e83]">{task.count} na fila</p> : null}</div><ArrowRight size={20} className="mt-1 shrink-0 text-[#087e83]" />
    </Link>)}</div>
    <Link href="/laboratorio" className="flex min-h-14 items-center gap-3 rounded-xl border border-[#dce5e7] bg-white px-4 font-semibold text-[#087e83]"><ClipboardList size={20} />Consultar ou procurar uma OS<ArrowRight size={18} className="ml-auto" /></Link>
    <details className="rounded-xl border border-[#dce5e7] bg-white p-4"><summary className="cursor-pointer text-base font-semibold">Como funciona o laboratório?</summary><ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-relaxed text-[#425f65]"><li>Cadastre a OS e coloque o material na gaveta do vendedor.</li><li>Complete o pedido e a previsão de chegada em “Lentes e pedidos”.</li><li>Quando as lentes chegarem, confirme o recebimento.</li><li>Na bancada, registre cada etapa e qualquer problema encontrado.</li><li>Após a conferência final, libere e registre a retirada.</li></ol><p className="mt-3 text-xs text-[#60767b]">Precisa dos relatórios e demais recursos? Escolha “Completo” no menu.</p></details>
  </div>;
}
