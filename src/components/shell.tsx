"use client";

import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  Lightbulb,
  Loader2,
  RefreshCcw,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  QrCode,
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

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/laboratorio", label: "Laboratório", icon: ClipboardList },
      { href: "/laboratorio/rapido", label: "Lançamento rápido", icon: Zap },
      { href: "/montagem", label: "Bancada de montagem", icon: Wrench },
      { href: "/ranking", label: "Ranking", icon: Trophy },
      { href: "/estoque", label: "Estoque de lentes", icon: Package },
    ],
  },
  {
    title: "Melhoria contínua",
    items: [
      { href: "/melhoria", label: "Visão Lean", icon: RefreshCcw },
      { href: "/melhoria/indicadores", label: "Lean Six Sigma", icon: Activity },
      { href: "/melhoria/kaizen", label: "Kaizen", icon: Lightbulb },
      { href: "/melhoria/5s", label: "Auditoria 5S", icon: ClipboardCheck },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/lojas", label: "Lojas", icon: Store },
      { href: "/vendedores", label: "Vendedores", icon: Users },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/recados", label: "Recados", icon: MessageSquare },
      { href: "/relatorios", label: "Relatórios", icon: FileText },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

// Telas visíveis no menu por perfil (null = todas). As rotas continuam protegidas no servidor.
const ACCESS: Record<AppRole, string[] | null> = {
  admin: null,
  gestor: null,
  montador: ["/laboratorio/rapido", "/montagem", "/ranking", "/recados", "/melhoria", "/melhoria/kaizen", "/melhoria/5s"],
  estoquista: ["/laboratorio", "/estoque", "/ranking", "/recados", "/melhoria", "/melhoria/kaizen", "/melhoria/5s"],
  consulta: [
    "/dashboard",
    "/laboratorio",
    "/montagem",
    "/ranking",
    "/estoque",
    "/lojas",
    "/vendedores",
    "/relatorios",
    "/melhoria",
    "/melhoria/indicadores",
    "/melhoria/kaizen",
    "/melhoria/5s",
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
}: {
  children: React.ReactNode;
  name: string;
  role: AppRole;
  orgName: string;
  unread?: number;
  openOrders?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const allowed = ACCESS[role];
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !allowed || allowed.includes(item.href)) }))
    .filter((group) => group.items.length > 0);
  const current = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const readOnly = role === "consulta";

  const nav = (
    <nav className="flex flex-col gap-[18px]">
      {visibleGroups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-xs font-medium text-[#8a9694]">{group.title}</p>
          {group.items.map((item) => {
            const active = current?.href === item.href;
            const Icon = item.icon;
            const count = item.href === "/recados" ? unread : item.href === "/laboratorio" ? openOrders : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  active ? "bg-[#e4f1ef] font-semibold text-[#0a4f48]" : "font-medium text-[#44524f] hover:bg-[#f2f5f5]",
                )}
              >
                <Icon size={17} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                <PendingDot />
                {count > 0 ? (
                  <span className="rounded-md bg-[#e4f1ef] px-[7px] py-px text-xs font-semibold text-[#0a4f48]">{count}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-[60px] items-center gap-2.5 border-b border-[#e2e7e9] px-[18px]">
      <LensMark size={32} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight">{orgName}</span>
        <span className="text-xs text-[#6e7c7a]">Gestão operacional</span>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2.5 border-t border-[#e2e7e9] px-[18px] py-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#0e6b62]" />
      <div className="flex flex-col leading-tight">
        <span className="text-xs text-[#6e7c7a]">Laboratório ativo</span>
        <span className="text-[13px] font-semibold">{orgName}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#e2e7e9] bg-white lg:flex">
        {brand}
        <div className="flex-1 overflow-auto px-3 py-3.5">{nav}</div>
        {footer}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-[#13201f]/30" onClick={() => setMobileOpen(false)} type="button" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="relative">
              {brand}
              <button aria-label="Fechar menu" className="absolute right-3 top-4 rounded-md p-1 text-[#44524f] hover:bg-[#f2f4f5]" onClick={() => setMobileOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-3 py-3.5">{nav}</div>
            {footer}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[248px]">
        <header className="no-print sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b border-[#e2e7e9] bg-white px-3 md:px-5">
          <button aria-label="Abrir menu" className="rounded-md p-2 text-[#44524f] lg:hidden" onClick={() => setMobileOpen(true)} type="button">
            <Menu size={18} />
          </button>
          <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-[13px] text-[#6e7c7a] sm:flex">
            <span>Painel</span>
            <span className="text-[#cdd5d8]">/</span>
            <span className="font-semibold text-[#13201f]">{current?.label ?? "Início"}</span>
          </div>
          <form action="/laboratorio" method="get" className="hidden min-w-0 max-w-[420px] flex-1 md:ml-3 md:flex">
            <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#e2e7e9] bg-[#f7f9f9] px-2.5 text-[#6e7c7a] focus-within:border-[#0e6b62] focus-within:ring-[3px] focus-within:ring-[#0e6b62]/20">
              <Search size={16} className="shrink-0" />
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
            className="hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#cdd5d8] bg-white px-3 text-sm font-medium text-[#13201f] hover:bg-[#f7f9f9] sm:flex"
          >
            <QrCode size={16} />
            Ler QR Code
          </Link>
          <div className="hidden h-7 w-px bg-[#e2e7e9] sm:block" />
          <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e4f1ef] text-xs font-bold text-[#0a4f48]">{initials(name)}</div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-[13px] font-semibold">{name}</span>
              <span className="text-xs text-[#6e7c7a]">{ROLE_LABEL[role]}</span>
            </div>
            <form action={signOut}>
              <button type="submit" className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-[#44524f] hover:bg-[#f2f4f5]">
                <LogOut size={15} />
                Sair
              </button>
            </form>
          </div>
        </header>
        <main className="flex min-w-0 flex-col px-4 pb-12 pt-6 md:px-8 md:pt-7">{children}</main>
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
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-[#6e7c7a]">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2.5">{children}</div> : null}
    </div>
  );
}
