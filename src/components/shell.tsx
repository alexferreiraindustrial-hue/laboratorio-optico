"use client";

import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  FileText,
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
import { useState } from "react";
import { signOut } from "@/server/actions";
import { LensMark } from "@/components/lens";
import { ROLE_LABEL, type AppRole } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

// Menu na ordem do fluxo da produção.
// Grupos com adminOnly=true ficam ocultos para montador/estoquista — o fluxo fica limpo.
const groups: { title: string; step?: string; adminOnly?: boolean; items: NavItem[] }[] = [
  {
    title: "Hoje",
    items: [
      { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
      { href: "/rotina", label: "Rotina do dia", icon: ListChecks },
    ],
  },
  {
    title: "Entrada",
    step: "1",
    items: [
      { href: "/laboratorio/rapido", label: "Lançar OS", icon: Zap },
      { href: "/laboratorio", label: "Todas as OS", icon: ClipboardList },
    ],
  },
  {
    title: "Lentes",
    step: "2",
    items: [
      { href: "/lentes", label: "Lentes a chegar", icon: PackageSearch },
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
    items: [{ href: "/entrega", label: "Entrega ao vendedor", icon: PackageCheck }],
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
    "/lentes",
    "/montagem",
    "/assistencia",
    "/ranking",
    "/recados",
    "/melhoria",
    "/melhoria/kaizen",
    "/melhoria/5s",
  ],
  estoquista: ["/rotina", "/laboratorio", "/lentes", "/estoque", "/ranking", "/recados", "/melhoria", "/melhoria/kaizen", "/melhoria/5s"],
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

/** Indicador instantâneo de navegação: aparece no item clicado enquanto a próxima tela carrega. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 size={14} className="animate-spin text-[#0e6b62]" aria-label="Carregando" /> : null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


export function Shell({
  children,
  name,
  role,
  orgName,
  unread = 0,
  openOrders = 0,
  boOpen = 0,
  lensLate = 0,
}: {
  children: React.ReactNode;
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
  const allowed = ACCESS[role];
  const isAdmin = ADMIN_ROLES.includes(role);

  const visibleGroups = groups
    .filter((group) => isAdmin || !group.adminOnly)
    .map((group) => ({ ...group, items: group.items.filter((item) => !allowed || allowed.includes(item.href)) }))
    .filter((group) => group.items.length > 0);

  const current = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const readOnly = role === "consulta";

  const nav = (
    <nav className="flex flex-col gap-[14px]">
      {visibleGroups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 px-2.5 pb-1 text-xs font-medium text-[#8a9694]">
            {group.step ? (
              <span className="grid h-4 w-4 place-items-center rounded bg-[#e4f1ef] font-mono text-[10px] font-bold text-[#0a4f48]">{group.step}</span>
            ) : null}
            {group.title}
          </p>
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
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  active ? "bg-[#e4f1ef] font-semibold text-[#0a4f48]" : "font-medium text-[#44524f] hover:bg-[#f2f5f5]",
                )}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                <PendingDot />
                {count > 0 ? (
                  <span className={cn("rounded-md px-[7px] py-px text-xs font-semibold", alert ? "bg-[#fdecea] text-[#a3261b]" : "bg-[#e4f1ef] text-[#0a4f48]")}>{count}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-[56px] items-center gap-2.5 border-b border-[#e2e7e9] px-[18px]">
      <LensMark size={28} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight">{orgName}</span>
        <span className="text-[11px] text-[#6e7c7a]">Lab · Gestão operacional</span>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2 border-t border-[#e2e7e9] px-[18px] py-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e4f1ef] text-xs font-bold text-[#0a4f48]">{initials(name)}</div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold">{name}</span>
        <span className="text-[11px] text-[#6e7c7a]">{ROLE_LABEL[role]}</span>
      </div>
      <form action={signOut} className="ml-auto">
        <button type="submit" title="Sair" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6e7c7a] hover:bg-[#f2f4f5]">
          <LogOut size={14} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-[#e2e7e9] bg-white lg:flex">
        {brand}
        <div className="flex-1 overflow-auto px-3 py-3">{nav}</div>
        {footer}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-[#13201f]/30" onClick={() => setMobileOpen(false)} type="button" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="relative">
              {brand}
              <button aria-label="Fechar menu" className="absolute right-3 top-3.5 rounded-md p-1 text-[#44524f] hover:bg-[#f2f4f5]" onClick={() => setMobileOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-3 py-3">{nav}</div>
            {footer}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[232px]">
        <header className="no-print sticky top-0 z-20 flex h-[56px] items-center gap-4 border-b border-[#e2e7e9] bg-white px-3 md:px-5">
          <button aria-label="Abrir menu" className="rounded-md p-2 text-[#44524f] lg:hidden" onClick={() => setMobileOpen(true)} type="button">
            <Menu size={18} />
          </button>
          <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-[13px] text-[#6e7c7a] sm:flex">
            <span>Painel</span>
            <span className="text-[#cdd5d8]">/</span>
            <span className="font-semibold text-[#13201f]">{current?.label ?? "Início"}</span>
          </div>
          <form action="/laboratorio" method="get" className="hidden min-w-0 max-w-[360px] flex-1 md:ml-3 md:flex">
            <label className="flex h-8 w-full items-center gap-2 rounded-lg border border-[#e2e7e9] bg-[#f7f9f9] px-2.5 text-[#6e7c7a] focus-within:border-[#0e6b62]">
              <Search size={15} className="shrink-0" />
              <input
                name="q"
                placeholder="Buscar OS, cliente ou vendedor"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#13201f] shadow-none outline-none placeholder:text-[#8a9694] focus:shadow-none"
              />
            </label>
          </form>
          <div className="flex-1" />
          {readOnly ? (
            <span className="hidden shrink-0 whitespace-nowrap rounded-md bg-[#eef1f3] px-2 py-1 text-xs font-semibold text-[#44524f] sm:inline">
              Somente leitura
            </span>
          ) : null}
          <Link
            href="/estoque/leitura"
            className="hidden h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#cdd5d8] bg-white px-2.5 text-sm font-medium text-[#13201f] hover:bg-[#f7f9f9] sm:flex"
          >
            <QrCode size={15} />
            QR Code
          </Link>
          <div className="hidden h-6 w-px bg-[#e2e7e9] sm:block" />
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-[#e4f1ef] text-xs font-bold text-[#0a4f48]">{initials(name)}</div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-[13px] font-semibold">{name}</span>
              <span className="text-[11px] text-[#6e7c7a]">{ROLE_LABEL[role]}</span>
            </div>
            <form action={signOut}>
              <button type="submit" className="flex h-7 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-[#44524f] hover:bg-[#f2f4f5]">
                <LogOut size={14} />
                Sair
              </button>
            </form>
          </div>
        </header>
        <main className="flex min-w-0 flex-col px-4 pb-12 pt-5 md:px-7 md:pt-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-[#6e7c7a]">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
