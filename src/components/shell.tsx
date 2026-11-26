"use client";

import {
  Activity,
  Bell,
  Plus,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Glasses,
  Truck,
  Home,
  LayoutList,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PackageCheck,
  PackageSearch,
  QrCode,
  ScanBarcode,
  Tags,
  RefreshCcw,
  Search,
  Settings,
  Store,
  Trophy,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/server/actions";
import { OperationModeProvider } from "./operation-mode";
import { setViewMode } from "@/server/simple-mode";
import { SIMPLE_NAV, simpleAllowed, hasProductionOverview } from "@/lib/domain/simple-nav";
import { LensMark } from "@/components/lens";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABEL, type AppRole } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { GlobalOrderMenu } from "./order-context-menu";
import { LabelQueueChip } from "./label-queue-chip";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

// Menu na ordem do fluxo da produção.
// Grupos com adminOnly=true ficam ocultos para montador/estoquista — o fluxo fica limpo.
const groups: { title: string; step?: string; adminOnly?: boolean; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { href: "/dashboard", label: "Visão do dia", icon: LayoutDashboard },
      { href: "/rotina", label: "Rotina do dia", icon: ListChecks },
    ],
  },
  {
    title: "Entrada",
    step: "1",
    items: [
      { href: "/laboratorio/rapido", label: "Lançar serviço", icon: Zap },
      { href: "/laboratorio", label: "Fila de produção", icon: ClipboardList },
      { href: "/pdv", label: "PDV da produção", icon: ScanBarcode },
      { href: "/laboratorio/etiquetas", label: "Etiquetas", icon: Tags },
      { href: "/avisos", label: "Avisos por vendedora", icon: ClipboardList },
    ],
  },
  {
    title: "Lentes",
    step: "2",
    items: [
      { href: "/lentes", label: "Pedidos e lentes", icon: PackageSearch },
      { href: "/estoque", label: "Estoque de lentes", icon: Package },
    ],
  },
  {
    title: "Montagem",
    step: "3",
    items: [
      { href: "/montagem", label: "Bancada", icon: Wrench },
      { href: "/assistencia", label: "Assistência · BO", icon: LifeBuoy },
    ],
  },
  {
    title: "Saída",
    step: "4",
    items: [{ href: "/entrega", label: "Saída do laboratório", icon: PackageCheck }, { href: "/pos-venda", label: "Entrega ao cliente · pós-venda", icon: MessageSquare }],
  },
  {
    title: "Equipe",
    adminOnly: true,
    items: [
      { href: "/vendedores", label: "Vendedores", icon: Users },
      { href: "/lojas", label: "Lojas", icon: Store },
      { href: "/recados", label: "Recados", icon: MessageSquare },
      { href: "/ranking", label: "Ranking", icon: Trophy },
    ],
  },
  {
    title: "Gestão",
    adminOnly: true,
    items: [
      { href: "/melhoria", label: "Visão Lean", icon: RefreshCcw },
      { href: "/melhoria/indicadores", label: "Lean Six Sigma", icon: Activity },
      { href: "/melhoria/kaizen", label: "Kaizen", icon: Lightbulb },
      { href: "/melhoria/5s", label: "Auditoria 5S", icon: ClipboardCheck },
      { href: "/relatorios", label: "Relatórios", icon: FileText },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

// Perfis que veem o menu completo
const ADMIN_ROLES: AppRole[] = ["admin", "gestor", "consulta"];

// Telas visíveis no menu por perfil (null = todas). As rotas continuam protegidas no servidor.
const ACCESS: Record<AppRole, string[] | null> = {
  admin: null,
  gestor: null,
  montador: [
    "/rotina",
    "/laboratorio/rapido",
    "/pdv",
    "/laboratorio/etiquetas",
    "/avisos",
    "/lentes",
    "/montagem",
    "/assistencia",
    "/ranking",
    "/recados",
    "/melhoria",
    "/melhoria/kaizen",
    "/melhoria/5s",
  ],
  estoquista: ["/rotina", "/laboratorio", "/laboratorio/etiquetas", "/lentes", "/estoque", "/ranking", "/recados", "/melhoria", "/melhoria/kaizen", "/melhoria/5s"],
  consulta: [
    "/dashboard",
    "/rotina",
    "/laboratorio",
    "/lentes",
    "/estoque",
    "/montagem",
    "/assistencia",
    "/melhoria",
    "/melhoria/indicadores",
    "/melhoria/kaizen",
    "/melhoria/5s",
    "/vendedores",
    "/lojas",
    "/ranking",
    "/relatorios",
  ],
};

const allItems = groups.flatMap((group) => group.items);

// Barra fina (versão limpa): um ícone com nome curto por grupo; as telas do grupo viram abas no topo.
const GROUP_RAIL: Record<string, { short: string; icon: typeof LayoutDashboard }> = {
  "Operação": { short: "Visão do dia", icon: LayoutDashboard },
  "Entrada": { short: "OS", icon: ClipboardList },
  "Lentes": { short: "Lentes", icon: Glasses },
  "Montagem": { short: "Bancada", icon: Wrench },
  "Saída": { short: "Saída", icon: Truck },
  "Equipe": { short: "Equipe", icon: Users },
  "Gestão": { short: "Gestão", icon: Activity },
};
/** Configurações fica no rodapé da barra fina, fora das abas. */
const RAIL_FOOTER = "/configuracoes";

const SIMPLE_ICON: Record<string, typeof LayoutDashboard> = {
  "/inicio": Home,
  "/laboratorio/rapido": Zap,
  "/lentes": PackageSearch,
  "/montagem": Wrench,
  "/entrega": PackageCheck,
  "/pdv": ScanBarcode,
};

function simpleItems(role: AppRole) {
  return SIMPLE_NAV.filter((item) => simpleAllowed(role, item.href)).map((item) => item.href === "/inicio" && hasProductionOverview(role) ? { ...item, label: "Visão geral", hint: "Produção, prazos e atalhos", icon: LayoutDashboard } : { ...item, icon: SIMPLE_ICON[item.href] });
}

/** Botão que troca entre modo simples e menu completo. */
function ModeSwitch({ simple, className }: { simple: boolean; className?: string }) {
  return (
    <form action={setViewMode} className={className}>
      <input type="hidden" name="modo" value={simple ? "completo" : "simples"} />
      <button
        type="submit"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--edge-29474d)] px-3 text-left text-sm font-semibold text-[var(--fg-e4f0f1)] transition-colors hover:bg-[var(--bg-1c4148)]"
      >
        {simple ? <LayoutList size={18} /> : <Home size={18} />}
        <span className="flex-1">{simple ? "Ver menu completo" : "Usar modo simples"}</span>
      </button>
    </form>
  );
}

/** Versão em ícone do botão de modo simples, para a barra fina. */
function ModeSwitchIcon({ simple }: { simple: boolean }) {
  return (
    <form action={setViewMode}>
      <input type="hidden" name="modo" value={simple ? "completo" : "simples"} />
      <button type="submit" aria-label={simple ? "Ver menu completo" : "Usar modo simples"} title={simple ? "Ver menu completo" : "Usar modo simples"} className="lab-rail-round">{simple ? <LayoutList size={19} /> : <Home size={19} />}</button>
    </form>
  );
}

/** Indicador instantâneo de navegação: aparece no item clicado enquanto a próxima tela carrega. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 size={14} className="animate-spin text-[var(--link)]" aria-label="Carregando" /> : null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


export function Shell({
  children,
  simple = false,
  name,
  role,
  orgName,
  unread = 0,
  openOrders = 0,
  boOpen = 0,
  lensLate = 0,
}: {
  children: React.ReactNode;
  simple?: boolean;
  initialSidebarCollapsed?: boolean;
  name: string;
  role: AppRole;
  orgName: string;
  unread?: number;
  openOrders?: number;
  boOpen?: number;
  lensLate?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [mobileOpen]);
  const allowed = ACCESS[role];
  const isAdmin = ADMIN_ROLES.includes(role);

  const visibleGroups = groups
    .filter((group) => isAdmin || !group.adminOnly)
    .map((group) => ({ ...group, items: group.items.filter((item) => !allowed || allowed.includes(item.href)) }))
    .filter((group) => group.items.length > 0);

  const simpleNav = simpleItems(role);
  const current = [...allItems, ...simpleNav]
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.href === current?.href));
  const sectionTabs = (activeGroup?.items ?? []).filter((item) => item.href !== RAIL_FOOTER);
  const canSettings = visibleGroups.some((group) => group.items.some((item) => item.href === RAIL_FOOTER));
  const groupCount = (title: string) => (title === "Entrada" ? openOrders : title === "Lentes" ? lensLate : title === "Montagem" ? boOpen : title === "Equipe" ? unread : 0);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || !(target instanceof HTMLElement) || target.closest("input,textarea,select,[contenteditable='true'],[role='dialog']")) return;
      event.preventDefault();
      document.getElementById("global-order-search")?.focus();
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const readOnly = role === "consulta";
  const canLaunch = can(role, "orders.write");

  const simpleMenu = (
    <nav aria-label="Navegação do laboratório" className="flex flex-col gap-2">
      {simpleNav.map((item) => {
        const active = current?.href === item.href || (hasProductionOverview(role) && item.href === "/inicio" && pathname === "/dashboard");
        const Icon = item.icon;
        const count = item.href === "/lentes" ? lensLate : 0;
        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex min-h-[60px] items-center gap-3 rounded-2xl px-3 transition-colors"
          >
            <Icon size={24} strokeWidth={2.2} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[17px] font-semibold">{item.label}</span>
              <span className="mt-0.5 text-[13px] opacity-80">{item.hint}</span>
            </span>
            <PendingDot />
            {count > 0 ? <span className="rounded-full bg-[var(--danger-solid)] px-2 py-0.5 text-sm font-bold text-white">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const fullMenu = (
    <nav aria-label="Navegação do laboratório" className="flex flex-col gap-5">
      {visibleGroups.map((group) => (
        <details key={group.title} open={!group.adminOnly || group.items.some((item) => item.href === current?.href)} className="group flex flex-col gap-0.5">
          <summary className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {group.step ? (
              <span className="grid h-4 w-4 place-items-center rounded-md bg-[var(--accent-soft)] font-mono text-[10px] font-bold text-[var(--link)]">{group.step}</span>
            ) : null}
            {group.title}{group.adminOnly ? <span className="ml-auto text-sm group-open:rotate-90">›</span> : null}
          </summary>
          {group.items.map((item) => {
            const active = current?.href === item.href;
            const Icon = item.icon;
            const count =
              item.href === "/recados"
                ? unread
                : item.href === "/laboratorio"
                  ? openOrders
                  : item.href === "/assistencia"
                    ? boOpen
                    : item.href === "/lentes"
                      ? lensLate
                      : 0;
            const alert = (item.href === "/assistencia" || item.href === "/lentes") && count > 0;
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-out)] md:min-h-9 md:h-9",
                  active ? "bg-[var(--accent)] font-semibold text-white shadow-[0_10px_20px_-14px_rgba(34,34,34,.10)]" : "font-medium text-[var(--muted)] hover:bg-[var(--accent-soft)]",
                )}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                <PendingDot />
                {count > 0 ? (
                  <span className={cn("rounded-full px-[7px] py-px text-xs font-semibold", alert ? "bg-[var(--danger-soft)] text-[var(--danger)]" : active ? "bg-[var(--bg-c3e7e5)] text-[var(--link)]" : "bg-[var(--accent-soft)] text-[var(--link)]")}>{count}</span>
                ) : null}
              </Link>
            );
          })}
        </details>
      ))}
    </nav>
  );

  const nav = (
    <div className="flex flex-col gap-4">
      {simple ? simpleMenu : fullMenu}
      <ModeSwitch simple={simple} />
    </div>
  );

  const brand = (
    <div className="lab-brand flex h-[80px] items-center gap-2.5 border-b border-[var(--line)] px-[18px]">
      <LensMark size={30} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="display truncate text-[17px]">LabGold</span>
        <small className="mt-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)]">{orgName === "Lab Gold" ? "LABORATÓRIO ÓPTICO" : orgName}</small>
      </div>
    </div>
  );

  const footer = (
    <div className="lab-account lg-glass flex items-center gap-2 border-t border-[var(--line)] px-[18px] py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{initials(name)}</div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold">{name}</span>
        <span className="text-[11px] text-[var(--muted)]">{ROLE_LABEL[role]}</span>
      </div>
      <form action={signOut} className="ml-auto">
        <button type="submit" title="Sair" className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] md:h-8 md:w-8">
          <LogOut size={14} />
        </button>
      </form>
    </div>
  );

  const rail = (
    <aside id="desktop-sidebar" aria-label="Menu principal" className={cn("lab-rail no-print fixed inset-y-0 left-0 z-30 hidden w-[84px] flex-col items-center gap-0.5 border-r border-[var(--line)] bg-[var(--sidebar-bg,var(--surface))] py-3 lg:flex")}>
      <Link href={hasProductionOverview(role) || !visibleGroups[0] ? "/dashboard" : visibleGroups[0].items[0].href} aria-label="LabGold · início" className="mb-3 grid h-10 w-10 place-items-center"><LensMark size={34} /></Link>
      <nav aria-label="Áreas do laboratório" className="flex w-full flex-col items-center gap-0.5">
        {simple ? simpleNav.map((item) => {
          const Icon = item.icon;
          const active = current?.href === item.href || (hasProductionOverview(role) && item.href === "/inicio" && pathname === "/dashboard");
          const count = item.href === "/lentes" ? lensLate : 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={item.hint} className="lab-rail-item">
              <span className="lab-rail-icon"><Icon size={20} strokeWidth={1.9} />{count > 0 ? <span className="lab-rail-count" data-alert>{count}</span> : null}</span>
              <span className="lab-rail-label">{item.label}</span>
            </Link>
          );
        }) : visibleGroups.map((group) => {
          const meta = GROUP_RAIL[group.title] ?? { short: group.title, icon: LayoutDashboard };
          const target = group.items.find((item) => item.href !== RAIL_FOOTER);
          if (!target) return null;
          const Icon = meta.icon;
          const active = activeGroup?.title === group.title;
          const count = groupCount(group.title);
          return (
            <Link key={group.title} href={target.href} aria-current={active ? "page" : undefined} title={group.items.map((item) => item.label).join(" · ")} className="lab-rail-item">
              <span className="lab-rail-icon"><Icon size={20} strokeWidth={1.9} />{count > 0 ? <span className="lab-rail-count" data-alert={group.title === "Lentes" || group.title === "Montagem" || undefined}>{count > 99 ? "99+" : count}</span> : null}</span>
              <span className="lab-rail-label">{meta.short}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <ModeSwitchIcon simple={simple} />
        {canSettings ? <Link href={RAIL_FOOTER} aria-label="Configurações" title="Configurações" aria-current={current?.href === RAIL_FOOTER ? "page" : undefined} className="lab-rail-round"><Settings size={20} /></Link> : null}
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sidebar-active)] text-[13px] font-bold text-[var(--sidebar-active-text)]" title={`${name} · ${ROLE_LABEL[role]}`}>{initials(name)}</span>
        <form action={signOut}><button type="submit" aria-label="Sair" title="Sair" className="lab-rail-round"><LogOut size={18} /></button></form>
      </div>
    </aside>
  );

  return (
    <OperationModeProvider simple={simple}>
    <div className={cn("lg-app min-h-screen", simple && "lab-simple")}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:p-3">Ir para o conteúdo</a>
      {rail}

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-[var(--solid-ink)]/35" onClick={() => setMobileOpen(false)} type="button" />
          <aside className="lab-sidebar absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="relative">
              {brand}
              <button aria-label="Fechar menu" className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--accent-soft)]" onClick={() => setMobileOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-3 py-3">{nav}</div>
            {footer}
          </aside>
        </div>
      ) : null}

      <div className={cn("flex min-h-screen min-w-0 flex-col","lg:pl-[84px]")}>
        <header className="lg-topbar no-print sticky top-0 z-20 flex min-h-[60px] items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-2 pt-[env(safe-area-inset-top)] sm:gap-4 md:px-5">
          {sectionTabs.length > 1 && !simple ? <nav aria-label={`Telas de ${GROUP_RAIL[activeGroup!.title]?.short ?? activeGroup!.title}`} className="lab-section-tabs hidden lg:flex">
            {sectionTabs.map((item) => <Link key={item.href} href={item.href} aria-current={current?.href === item.href ? "page" : undefined}>{item.label}<PendingDot /></Link>)}
          </nav> : <span className="hidden lg:block lg:flex-1" />}
          <button aria-label="Abrir menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--accent-soft)] lg:hidden" onClick={() => setMobileOpen(true)} type="button">
            <Menu size={22} />
          </button>
          <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-[13px] text-[var(--muted)] sm:flex lg:hidden">
            <span>LabGold</span>
            <span className="text-[var(--fg-e2ddd5)]">/</span>
            <span className="font-semibold text-[var(--ink)]">{current?.label ?? "Início"}</span>
          </div>
          <form action="/laboratorio" method="get" className="min-w-0 max-w-[380px] flex-1 md:ml-3 lg:ml-auto lg:max-w-[300px]">
            <label className="flex h-11 w-full items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--muted)] focus-within:border-[var(--accent)] md:h-9">
              <Search size={16} className="shrink-0" />
              <input
                id="global-order-search"
                aria-label="Buscar OS, cliente ou vendedor"
                name="q"
                placeholder="Buscar OS, cliente ou vendedor"
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-[var(--ink)] shadow-none outline-none placeholder:text-[var(--muted)] focus:shadow-none md:text-sm"
              />
            </label>
          </form>
          {readOnly ? (
            <span className="hidden shrink-0 whitespace-nowrap rounded-full bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] sm:inline">
              Somente leitura
            </span>
          ) : null}
          <Link
            href="/estoque/leitura"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--accent-soft)] sm:flex sm:h-11 sm:w-auto sm:items-center sm:gap-1.5 sm:px-3 md:h-9"
            aria-label="Ler QR Code"
          >
            <QrCode size={18} />
            <span className="hidden sm:inline">QR Code</span>
          </Link>
          {allItems.some(item=>item.href==="/recados") && <Link href="/recados" aria-label={unread ? `${unread} recados não lidos` : "Recados do laboratório"} className="relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] xl:flex"><Bell size={18}/>{unread>0&&<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--accent)]"/>}</Link>}
          <Link href="/pdv" className="lab-pdv-btn" aria-label="Abrir o PDV da produção"><ScanBarcode size={18} /><span>PDV</span></Link>
          {canLaunch && <Link href="/laboratorio/rapido" className="lg-gold hidden min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold lg:inline-flex"><Plus size={17}/>Lançar serviço</Link>}
          <div id="theme-control" className="lab-theme-slot" />
          <div className="hidden h-6 w-px bg-[var(--line)] sm:block lg:hidden" />
          <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap sm:flex lg:hidden">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{initials(name)}</div>
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-[13px] font-semibold">{name}</span>
              <span className="text-[11px] text-[var(--muted)]">{ROLE_LABEL[role]}</span>
            </div>
            <form action={signOut}>
              <button type="submit" className="flex h-11 items-center gap-1 rounded-xl px-2 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--accent-soft)] md:h-8">
                <LogOut size={14} />
                Sair
              </button>
            </form>
          </div>
        </header>
        <main id="conteudo" className="lab-workspace flex min-w-0 flex-col px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pt-5 lg:px-9 lg:pt-4 lg:pb-12">
          {!simple && sectionTabs.length > 1 ? <nav aria-label={`Telas de ${GROUP_RAIL[activeGroup!.title]?.short ?? activeGroup!.title}`} className="lab-section-tabs no-print lg:hidden">
            {sectionTabs.map((item) => <Link key={item.href} href={item.href} aria-current={current?.href === item.href ? "page" : undefined}>{item.label}<PendingDot /></Link>)}
          </nav> : null}
          {children}
        </main>
        <GlobalOrderMenu role={role} />
        <LabelQueueChip />
      </div>

      <MobileDock
        simple={simple}
        simpleNav={simpleNav}
        role={role}
        pathname={pathname}
        onOpenMenu={() => setMobileOpen(true)}
        unread={unread}
        boOpen={boOpen}
        lensLate={lensLate}
      />
    </div>
    </OperationModeProvider>
  );
}

const DOCK: Record<AppRole, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  admin: [
    { href: "/dashboard", label: "Visão do dia", icon: LayoutDashboard },
    { href: "/laboratorio/rapido", label: "Lançar", icon: Zap },
    { href: "/montagem", label: "Bancada", icon: Wrench },
    { href: "/lentes", label: "Lentes", icon: PackageSearch },
  ],
  gestor: [
    { href: "/dashboard", label: "Visão do dia", icon: LayoutDashboard },
    { href: "/laboratorio/rapido", label: "Lançar", icon: Zap },
    { href: "/montagem", label: "Bancada", icon: Wrench },
    { href: "/lentes", label: "Lentes", icon: PackageSearch },
  ],
  montador: [
    { href: "/rotina", label: "Rotina", icon: ListChecks },
    { href: "/laboratorio/rapido", label: "Lançar", icon: Zap },
    { href: "/montagem", label: "Bancada", icon: Wrench },
    { href: "/lentes", label: "Lentes", icon: PackageSearch },
  ],
  estoquista: [
    { href: "/rotina", label: "Rotina", icon: ListChecks },
    { href: "/laboratorio", label: "OS", icon: ClipboardList },
    { href: "/lentes", label: "Lentes", icon: PackageSearch },
    { href: "/estoque", label: "Estoque", icon: Package },
  ],
  consulta: [
    { href: "/dashboard", label: "Visão do dia", icon: LayoutDashboard },
    { href: "/laboratorio", label: "OS", icon: ClipboardList },
    { href: "/montagem", label: "Bancada", icon: Wrench },
    { href: "/lentes", label: "Lentes", icon: PackageSearch },
  ],
};

function MobileDock({
  simple,
  simpleNav,
  role,
  pathname,
  onOpenMenu,
  unread,
  boOpen,
  lensLate,
}: {
  simple: boolean;
  simpleNav: { href: string; label: string; icon: typeof LayoutDashboard }[];
  role: AppRole;
  pathname: string;
  onOpenMenu: () => void;
  unread: number;
  boOpen: number;
  lensLate: number;
}) {
  // No modo simples o dock mostra os passos (até 5); o menu ☰ do topo abre o resto.
  const items = simple ? simpleNav.slice(0, 5) : DOCK[role];
  const columns = simple ? items.length : items.length + 1;
  return (
    <nav
      className="lg-mobile-dock no-print fixed inset-x-3 bottom-[calc(0.6rem+env(safe-area-inset-bottom))] z-30 grid rounded-[28px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_92%,white)] p-1.5 shadow-[var(--shadow-soft)] lg:hidden"
      aria-label="Atalhos do celular"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (hasProductionOverview(role) && item.href === "/inicio" && pathname === "/dashboard");
        const Icon = item.icon;
        const count = item.href === "/lentes" ? lensLate : item.href === "/assistencia" ? boOpen : item.href === "/recados" ? unread : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 font-semibold",
              simple ? "min-h-16 text-[12.5px]" : "min-h-14 text-[11px]",
              active ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]",
            )}
          >
            <Icon size={simple ? 26 : 22} strokeWidth={active ? 2.4 : 2} />
            <span className="leading-none">{item.href === "/dashboard" ? "Hoje" : item.label}</span>
            {count > 0 ? (
              <span className="absolute right-1/2 top-1.5 mr-[-18px] min-w-4 rounded-full bg-[var(--danger-solid)] px-1 text-[10px] font-bold leading-4 text-white">{count}</span>
            ) : null}
          </Link>
        );
      })}
      {simple ? null : <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-semibold text-[var(--muted)]"
      >
        <Menu size={22} />
        <span className="leading-none">Mais</span>
      </button>}
    </nav>
  );
}

export function PageHeading({
  title,
  description,
  children,
  stacked = false,
}: {
  title: import("react").ReactNode;
  description?: string;
  stacked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("lab-page-heading flex flex-col gap-3", stacked ? "items-start" : "sm:flex-row sm:flex-wrap sm:items-end sm:justify-between")}>
      <div>
        <h1 className="text-[26px] font-bold leading-tight md:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {children ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>a]:flex-1 sm:[&>a]:flex-none [&>button]:flex-1 sm:[&>button]:flex-none">{children}</div> : null}
    </div>
  );
}
