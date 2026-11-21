import { ChevronRight, PackageCheck, PackageSearch, Search, Wrench, Zap } from "lucide-react";
import Link from "next/link";
import { simpleAllowed } from "@/lib/domain/simple-nav";
import { requireProfile } from "@/server/session";

type Card = {
  step: string;
  href: string;
  title: string;
  when: string;
  icon: typeof Zap;
  count: number;
  countText: (n: number) => string;
  alert?: number;
  tone: string;
};

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "";
}

export default async function InicioPage() {
  const { supabase, profile, role } = await requireProfile();
  const nowIso = new Date().toISOString();
  const count = (statuses: string[]) =>
    supabase.from("service_orders").select("id", { count: "exact", head: true }).in("status", statuses);

  const [lenses, lensLate, bench, ready, late] = await Promise.all([
    count(["aguardando_lentes"]),
    supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_lentes")
      .lt("lens_expected_at", nowIso),
    count(["aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia"]),
    count(["pronto"]),
    supabase.from("service_orders").select("id", { count: "exact", head: true }).in("status", ["aguardando_lentes", "aguardando_montagem", "em_montagem", "em_correcao", "em_conferencia"]).lt("due_at", nowIso),
  ]);

  const countError = [lenses, lensLate, bench, ready, late].some((result) => Boolean(result.error));
  const allCards: Card[] = [
    {
      step: "1",
      href: "/laboratorio/rapido",
      title: "Lançar OS",
      when: "Chegou uma OS nova da loja ou da vendedora? Comece aqui.",
      icon: Zap,
      count: -1,
      countText: () => "",
      tone: "bg-[var(--accent)] text-white",
    },
    {
      step: "2",
      href: "/lentes",
      title: "Lentes",
      when: "Chegou lente do laboratório ou precisa ver o que falta chegar.",
      icon: PackageSearch,
      count: lenses.count ?? 0,
      countText: (n) => (n === 0 ? "Nenhuma OS esperando lente" : `${n} OS esperando lente`),
      alert: lensLate.count ?? 0,
      tone: "bg-[var(--bg-e8f1fb)] text-[var(--fg-1d4f8a)]",
    },
    {
      step: "3",
      href: "/montagem",
      title: "Montagem",
      when: "Óculos para montar, conferir ou corrigir na bancada.",
      icon: Wrench,
      count: bench.count ?? 0,
      countText: (n) => (n === 0 ? "Bancada vazia" : `${n} OS na bancada`),
      tone: "bg-[var(--bg-fff4e0)] text-[var(--fg-8a5300)]",
    },
    {
      step: "4",
      href: "/entrega",
      title: "Entrega",
      when: "Óculos pronto saindo para a loja ou para o cliente.",
      icon: PackageCheck,
      count: ready.count ?? 0,
      countText: (n) => (n === 0 ? "Nada para entregar" : `${n} OS ${n === 1 ? "pronta" : "prontas"} para entregar`),
      tone: "bg-[var(--ok-soft)] text-[var(--ok)]",
    },
  ];
  const cards = allCards.filter((card) => simpleAllowed(role, card.href));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight md:text-[34px]">
          {greeting()}, {firstName(profile.full_name)}!
        </h1>
        <p className="mt-2 text-base text-[var(--muted)] md:text-lg">O que você vai fazer agora? Toque em um dos botões.</p>
      </div>

      {countError ? <p role="alert" className="rounded-xl border border-[var(--edge-f1c4be)] bg-[var(--danger-soft)] p-4 text-[var(--danger)]">Não foi possível conferir todos os números. Atualize a página antes de conferir a fila.</p> : (late.count ?? 0) > 0 ? <Link href="/laboratorio?tab=atrasadas" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--edge-f1c4be)] bg-[var(--danger-soft)] p-4 font-semibold text-[var(--danger)]"><span>{late.count} serviço(s) com prazo vencido · conferir primeiro</span><ChevronRight size={22} /></Link> : null}

      <form action="/laboratorio" method="get" role="search">
        <label className="flex h-14 w-full items-center gap-3 rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 focus-within:border-[var(--accent)]">
          <Search size={22} className="shrink-0 text-[var(--muted)]" aria-hidden />
          <span className="sr-only">Procurar uma OS</span>
          <input
            name="q"
            inputMode="search"
            placeholder="Procurar OS pelo número ou nome do cliente"
            className="min-w-0 flex-1 border-0 bg-transparent text-base text-[var(--ink)] shadow-none outline-none placeholder:text-[var(--muted)] focus:shadow-none md:text-lg"
          />
          <button type="submit" className="hidden h-10 rounded-xl bg-[var(--accent)] px-4 text-base font-semibold text-white sm:block">
            Procurar
          </button>
        </label>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex min-h-[140px] items-center gap-4 rounded-3xl border-2 border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] transition-[border-color,transform] duration-150 hover:border-[var(--accent)] active:scale-[0.98] md:min-h-[170px] md:p-6"
            >
              <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl md:h-20 md:w-20 ${card.tone}`}>
                <Icon size={34} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--link)]" aria-label={`Passo ${card.step}`}>
                    {card.step}
                  </span>
                  <span className="text-[22px] font-bold leading-tight md:text-2xl">{card.title}</span>
                </span>
                <span className="text-[15px] leading-snug text-[var(--muted)] md:text-base">{card.when}</span>
                {card.count >= 0 && !countError ? (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-sm font-semibold text-[var(--fg-2d4a50)]">
                      {card.countText(card.count)}
                    </span>
                    {card.alert ? (
                      <span className="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-sm font-semibold text-[var(--danger)]">
                        {card.alert === 1 ? "1 lente atrasada" : `${card.alert} lentes atrasadas`}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <ChevronRight size={28} className="shrink-0 text-[var(--fg-9bb0b4)] transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          );
        })}
      </div>

      <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><summary className="cursor-pointer text-base font-semibold">Como funciona o laboratório?</summary><ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-relaxed text-[var(--muted)]"><li>Cadastre a OS e coloque o material na gaveta do vendedor.</li><li>Complete o pedido e a previsão de chegada na tela Lentes.</li><li>Quando as lentes chegarem, confirme o recebimento.</li><li>Na montagem, registre cada etapa e qualquer problema encontrado.</li><li>Após a conferência final, libere e registre a retirada.</li></ol><p className="mt-3 text-sm text-[var(--muted)]">Precisa de relatórios ou atalhos? Escolha “Ver menu completo”.</p></details>

      <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-[15px] leading-snug text-[var(--link)]">
        <strong>Dica:</strong> os números 1, 2, 3 e 4 mostram o caminho do óculos no laboratório: chega a OS, chega a lente, monta e entrega.
      </p>
    </div>
  );
}
