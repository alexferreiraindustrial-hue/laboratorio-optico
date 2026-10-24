"use client";

import { Maximize2, Settings2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { LensMark } from "@/components/lens";
import { Button, Feedback } from "@/components/ui";
import {
  RANK_POINTS,
  goalProgress,
  initialsOf,
  type RankBoard,
  type RankBoardKey,
  type RankEntry,
  type RankingSettings,
  type RankPeriod,
} from "@/lib/domain/ranking";
import { cn } from "@/lib/utils";
import { saveSetting } from "@/server/actions";

const PERIOD_LABEL: Record<RankPeriod, string> = { hoje: "Hoje", semana: "Esta semana", mes: "Este mês" };
const ROTATIONS = [15, 30, 60, 180, 300];

/** Aros do pódio: ouro, prata e bronze, como o aro de uma armação metálica. */
const RIMS = [
  { from: "#fff0b8", mid: "#e0b04a", to: "#8c6420", glow: "rgba(240,192,74,0.45)", text: "#f5cf6b" },
  { from: "#f7fafc", mid: "#b9c4cb", to: "#6f7c85", glow: "rgba(185,196,203,0.35)", text: "#d5dde2" },
  { from: "#ffd9b8", mid: "#c77d45", to: "#6e3a17", glow: "rgba(199,125,69,0.38)", text: "#e7a274" },
];

function avatarHue(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return [168, 176, 186, 158, 196, 150][hash % 6];
}

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function RankingBoard({
  boards,
  board,
  period,
  settings,
  canEdit,
  startTv,
  updatedAt,
}: {
  boards: RankBoard[];
  board: RankBoardKey;
  period: RankPeriod;
  settings: RankingSettings;
  canEdit: boolean;
  startTv: boolean;
  updatedAt: string;
}) {
  const [tv, setTv] = useState(startTv);
  const [showSettings, setShowSettings] = useState(false);
  const current = boards.find((item) => item.key === board) ?? boards[0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">Ranking</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#6e7c7a]">
            Quem mais produziu no período, calculado sozinho a partir das etapas, das OS e das ocorrências. Ponha no modo TV na parede da bancada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button variant="secondary" onClick={() => setShowSettings((value) => !value)} aria-expanded={showSettings}>
              <Settings2 size={16} />
              Prêmios e metas
            </Button>
          ) : null}
          <Button onClick={() => setTv(true)}>
            <Maximize2 size={16} />
            Modo TV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-xl border border-[#e2e7e9] bg-white p-1" aria-label="Quadro">
          {boards.map((item) => (
            <Link
              key={item.key}
              href={`/ranking?quadro=${item.key}&periodo=${period}`}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                item.key === current.key ? "bg-[#0e6b62] text-white" : "text-[#44524f] hover:bg-[#f2f5f5]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="inline-flex rounded-xl border border-[#e2e7e9] bg-white p-1" aria-label="Período">
          {(Object.keys(PERIOD_LABEL) as RankPeriod[]).map((key) => (
            <Link
              key={key}
              href={`/ranking?quadro=${current.key}&periodo=${key}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                key === period ? "bg-[#e4f1ef] font-semibold text-[#0a4f48]" : "text-[#44524f] hover:bg-[#f2f5f5]",
              )}
            >
              {PERIOD_LABEL[key]}
            </Link>
          ))}
        </nav>
      </div>

      {showSettings && canEdit ? <RankingSettingsForm settings={settings} period={period} onDone={() => setShowSettings(false)} /> : null}

      <Arena board={current} prizes={settings.premios ?? []} period={period} />

      {current.key === "montadores" ? (
        <p className="text-xs text-[#6e7c7a]">
          Pontos: {RANK_POINTS.montagem} por montagem (Facetadora concluída), +{RANK_POINTS.noPrazo} se saiu no prazo, {RANK_POINTS.etapa} por
          outra etapa concluída e {RANK_POINTS.ocorrencia} por ocorrência de qualidade na etapa feita pela pessoa.
        </p>
      ) : (
        <p className="text-xs text-[#6e7c7a]">Conta as OS enviadas ao laboratório no período. OS canceladas ficam de fora.</p>
      )}

      {tv ? (
        <TvMode
          boards={boards}
          initial={current.key}
          period={period}
          prizes={settings.premios ?? []}
          rotation={settings.rotacao ?? 30}
          updatedAt={updatedAt}
          onExit={() => setTv(false)}
        />
      ) : null}
    </div>
  );
}

function Arena({ board, prizes, period, tv = false }: { board: RankBoard; prizes: string[]; period: RankPeriod; tv?: boolean }) {
  const anyScore = board.entries.some((entry) => entry.score > 0);
  return (
    <section
      className={cn(
        "relative grid overflow-hidden rounded-2xl border border-[#d5e3e1] text-[#13201f] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]",
        tv ? "h-full gap-6 p-6" : "gap-4 p-3 sm:p-4",
      )}
      style={{ background: "radial-gradient(120% 100% at 22% 18%, #ffffff 0%, #f1f8f6 42%, #dcece8 100%)" }}
    >
      <Podium entries={board.entries.slice(0, 3)} prizes={prizes} board={board} empty={!anyScore} period={period} tv={tv} />
      <ol className={cn("grid content-start gap-2", tv ? "overflow-hidden" : "")}>
        {board.entries.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[#c5d6d3] bg-white/70 px-4 py-8 text-center text-sm text-[#6e7c7a]">
            Nenhum participante cadastrado neste quadro.
          </li>
        ) : null}
        {board.entries.slice(0, tv ? 8 : 50).map((entry, index) => (
          <RankRow key={entry.id} entry={entry} position={index + 1} board={board} tv={tv} />
        ))}
      </ol>
    </section>
  );
}

function Podium({
  entries,
  prizes,
  board,
  empty,
  period,
  tv,
}: {
  entries: RankEntry[];
  prizes: string[];
  board: RankBoard;
  empty: boolean;
  period: RankPeriod;
  tv: boolean;
}) {
  const order = [1, 0, 2];
  return (
    <div className={cn("relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-xl", tv ? "min-h-0" : "")}>
      {/* chão: anéis concêntricos como a mira de um lensômetro */}
      <svg aria-hidden viewBox="0 0 600 220" className="pointer-events-none absolute inset-x-0 bottom-0 w-full" preserveAspectRatio="none">
        <defs>
          <radialGradient id="arena-floor" cx="50%" cy="60%" r="55%">
            <stop offset="0%" stopColor="#3fb58f" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3fb58f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="300" cy="150" rx="300" ry="70" fill="url(#arena-floor)" />
        {[60, 110, 165, 225].map((rx, index) => (
          <ellipse key={rx} cx="300" cy="150" rx={rx} ry={rx * 0.24} fill="none" stroke="#0e6b62" strokeOpacity={0.22 - index * 0.045} />
        ))}
        <line x1="40" y1="150" x2="560" y2="150" stroke="#0e6b62" strokeOpacity="0.1" />
      </svg>

      <div className="relative z-10 px-3 pt-3 text-center">
        <p className="text-sm font-medium text-[#44524f]">
          {board.label} · {PERIOD_LABEL[period].toLowerCase()}
        </p>
        {empty ? <p className="mt-1 text-xs text-[#6e7c7a]">Ninguém pontuou ainda. O primeiro registro já vale lugar no pódio.</p> : null}
      </div>

      <div className={cn("relative z-10 mt-auto grid grid-cols-3 items-end gap-2 px-2 sm:gap-4 sm:px-6", tv ? "pb-6" : "pb-5")}>
        {order.map((place) => (
          <Medal key={place} entry={entries[place]} place={place} prize={prizes[place]} board={board} tv={tv} />
        ))}
      </div>
    </div>
  );
}

function Medal({
  entry,
  place,
  prize,
  board,
  tv,
}: {
  entry?: RankEntry;
  place: number;
  prize?: string;
  board: RankBoard;
  tv: boolean;
}) {
  const rim = RIMS[place];
  const first = place === 0;
  const size = first ? (tv ? 190 : 132) : tv ? 140 : 100;
  const pedestal = first ? (tv ? 150 : 104) : place === 1 ? (tv ? 110 : 76) : tv ? 84 : 58;

  return (
    <div className="flex min-w-0 flex-col items-center">
      {prize ? (
        <span
          className="mb-2 line-clamp-2 max-w-full rounded-xl px-2.5 py-1 text-center text-[11px] font-bold leading-tight sm:text-xs"
          style={{ background: `linear-gradient(135deg, ${rim.from}, ${rim.mid})`, color: "#2a1d05" }}
          title={prize}
        >
          <Trophy size={11} className="mr-1 inline align-[-1px]" />
          {prize}
        </span>
      ) : null}
      <div className="relative" style={{ width: size, height: size, maxWidth: "100%" }}>
        {first ? (
          <span
            aria-hidden
            className="absolute -inset-4 rounded-full motion-safe:animate-[glowpulse_3.2s_ease-in-out_infinite]"
            style={{ background: `radial-gradient(circle, ${rim.glow} 0%, transparent 68%)` }}
          />
        ) : null}
        {/* aro metálico */}
        <div
          className="relative grid h-full w-full place-items-center rounded-full p-[7%]"
          style={{
            background: `conic-gradient(from 210deg, ${rim.from}, ${rim.mid}, ${rim.to}, ${rim.mid}, ${rim.from})`,
            boxShadow: `0 18px 40px -12px ${rim.glow}`,
          }}
        >
          {/* vidro */}
          <div
            className="relative grid h-full w-full place-items-center overflow-hidden rounded-full"
            style={{ background: "radial-gradient(circle at 36% 30%, #ffffff 0%, #e4f3ef 50%, #bfe0d8 100%)" }}
          >
            <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              <g stroke="#0e6b62" strokeOpacity="0.16" strokeWidth="0.8" fill="none">
                <line x1="8" y1="50" x2="92" y2="50" />
                <line x1="50" y1="8" x2="50" y2="92" />
                <circle cx="50" cy="50" r="30" />
              </g>
              <path d="M24 32 A32 32 0 0 1 44 16" stroke="#ffffff" strokeOpacity="0.95" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            <span
              className="relative font-bold tracking-[-0.03em]"
              style={{ fontSize: size * 0.3, color: entry ? "#0a4f48" : "rgba(14,107,98,0.25)" }}
            >
              {entry ? initialsOf(entry.name) : "—"}
            </span>
          </div>
        </div>
        <span
          className="absolute -bottom-2 left-1/2 grid -translate-x-1/2 place-items-center rounded-full text-sm font-black text-[#1b1405] ring-4 ring-white"
          style={{ width: first ? 34 : 28, height: first ? 34 : 28, background: `linear-gradient(135deg, ${rim.from}, ${rim.mid})` }}
        >
          {place + 1}
        </span>
      </div>
      <div
        className="mt-4 flex w-full flex-col items-center justify-start rounded-t-xl px-1.5 pt-2.5 text-center"
        style={{
          height: pedestal,
          background: `linear-gradient(180deg, ${rim.glow} 0%, rgba(255,255,255,0.55) 100%)`,
          borderTop: `2px solid ${rim.mid}`,
        }}
      >
        <span className={cn("max-w-full truncate font-semibold", tv ? "text-lg" : "text-[13px] sm:text-sm")}>{entry?.name ?? "Vago"}</span>
        <span className={cn("tabular font-bold", tv ? "text-2xl" : "text-base sm:text-lg")} style={{ color: rim.to }}>
          {entry ? fmt(entry.score) : "0"}
          <span className="ml-1 text-[11px] font-medium text-[#6e7c7a]">{board.scoreLabel}</span>
        </span>
      </div>
    </div>
  );
}

function RankRow({ entry, position, board, tv }: { entry: RankEntry; position: number; board: RankBoard; tv: boolean }) {
  const progress = goalProgress(entry);
  const rim = position <= 3 ? RIMS[position - 1] : null;
  const hue = avatarHue(entry.id);
  return (
    <li
      className={cn(
        "grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#dfe8e7] bg-white/90 px-3 shadow-[0_1px_0_rgba(19,32,31,0.04)]",
        tv ? "py-3" : "py-2.5",
      )}
    >
      <span
        className={cn("tabular w-8 text-center font-black", tv ? "text-3xl" : "text-2xl")}
        style={{ color: rim ? rim.to : "#8a9694" }}
      >
        {position}
      </span>
      <span
        className={cn("grid place-items-center rounded-full font-bold text-[#0a4f48]", tv ? "h-12 w-12 text-base" : "h-10 w-10 text-sm")}
        style={{
          background: `hsl(${hue} 42% 89%)`,
          boxShadow: rim ? `0 0 0 2px ${rim.mid}` : "0 0 0 1px rgba(14,107,98,0.15)",
        }}
      >
        {initialsOf(entry.name)}
      </span>
      <div className="min-w-0">
        <p className={cn("truncate font-semibold", tv ? "text-lg" : "text-[15px]")}>{entry.name}</p>
        {progress ? (
          <>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e3ecec]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, progress.percent)}%`, background: "linear-gradient(90deg, #0e6b62, #3fb58f)" }}
                />
              </div>
              <span className="tabular w-12 text-right text-xs font-semibold text-[#44524f]">{progress.percent}%</span>
            </div>
            <p className="mt-0.5 text-xs text-[#6e7c7a]">
              Meta {fmt(entry.goal ?? 0)} {board.doneLabel} · feitas {fmt(entry.done)}
              {progress.missing > 0 ? (
                <span className="font-semibold text-[#a86e00]"> · faltam {fmt(progress.missing)}</span>
              ) : (
                <span className="font-semibold text-[#1f8a52]"> · meta batida</span>
              )}
            </p>
          </>
        ) : (
          <p className="mt-0.5 truncate text-xs text-[#6e7c7a]">
            {entry.stats.map((stat) => `${stat.label} ${stat.value}`).join("   ")}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className={cn("tabular font-bold leading-none", tv ? "text-2xl" : "text-xl")}>{fmt(entry.score)}</p>
        <p className="mt-1 text-[11px] text-[#6e7c7a]">{board.scoreLabel}</p>
      </div>
    </li>
  );
}

function TvMode({
  boards,
  initial,
  period,
  prizes,
  rotation,
  updatedAt,
  onExit,
}: {
  boards: RankBoard[];
  initial: RankBoardKey;
  period: RankPeriod;
  prizes: string[];
  rotation: number;
  updatedAt: string;
  onExit: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(Math.max(0, boards.findIndex((item) => item.key === initial)));
  const [seconds, setSeconds] = useState(rotation);
  const [elapsed, setElapsed] = useState(0);
  const [clock, setClock] = useState<string | null>(null);
  const tick = useRef(0);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onExit();
  }, [onExit]);

  useEffect(() => {
    void ref.current?.requestFullscreen?.().catch(() => undefined);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit();
      if (event.key === "ArrowRight") {
        setIndex((value) => (value + 1) % boards.length);
        tick.current = 0;
                setElapsed(0);
      }
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value - 1 + boards.length) % boards.length);
        tick.current = 0;
                setElapsed(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boards.length, exit]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()));
      tick.current += 1;
      if (tick.current >= seconds) {
        tick.current = 0;
        setIndex((current) => (current + 1) % boards.length);
      }
      setElapsed(tick.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds, boards.length]);

  // Dados novos a cada minuto, sem recarregar a tela.
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const board = boards[index];
  const updated = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(updatedAt)),
    [updatedAt],
  );

  return (
    <div ref={ref} className="fixed inset-0 z-[70] flex flex-col bg-[#eef3f3] text-[#13201f]">
      <header className="flex items-center gap-4 px-6 py-4">
        <LensMark size={34} />
        <div className="leading-tight">
          <p className="text-lg font-bold">Ranking · {board.label}</p>
          <p className="text-sm text-[#6e7c7a]">{PERIOD_LABEL[period]} · atualizado às {updated}</p>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-1 rounded-xl border border-[#e2e7e9] bg-white p-1 md:flex">
          {boards.map((item, position) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setIndex(position);
                tick.current = 0;
                setElapsed(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold",
                position === index ? "bg-[#0e6b62] text-white" : "text-[#44524f] hover:bg-[#f2f5f5]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#44524f]">
          Trocar a cada
          <select
            value={seconds}
            onChange={(event) => {
              setSeconds(Number(event.target.value));
              tick.current = 0;
                setElapsed(0);
            }}
            className="h-8 rounded-lg border border-[#cdd5d8] bg-white px-2 text-[#13201f]"
          >
            {ROTATIONS.map((value) => (
              <option key={value} value={value} className="text-[#13201f]">
                {value < 60 ? `${value}s` : `${value / 60} min`}
              </option>
            ))}
          </select>
        </label>
        <span className="tabular hidden text-2xl font-bold sm:block">{clock}</span>
        <button
          type="button"
          onClick={exit}
          aria-label="Sair do modo TV"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#cdd5d8] bg-white hover:bg-[#f2f5f5]"
        >
          <X size={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 px-6">
        <Arena board={board} prizes={prizes} period={period} tv />
      </div>
      <footer className="px-6 py-4">
        <div className="h-1 overflow-hidden rounded-full bg-[#dfe8e8]">
          <div
            className="h-full rounded-full bg-[#0e6b62] transition-[width] duration-1000 ease-linear"
            style={{ width: `${(elapsed / seconds) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#6e7c7a]">Setas trocam o quadro · Esc sai do modo TV</p>
      </footer>
    </div>
  );
}

function RankingSettingsForm({ settings, period, onDone }: { settings: RankingSettings; period: RankPeriod; onDone: () => void }) {
  const router = useRouter();
  const [prizes, setPrizes] = useState<string[]>([0, 1, 2].map((index) => settings.premios?.[index] ?? ""));
  const [metas, setMetas] = useState(settings.metas ?? {});
  const [rotation, setRotation] = useState(settings.rotacao ?? 30);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const boardsForGoal: { key: RankBoardKey; label: string; unit: string }[] = [
    { key: "montadores", label: "Montadores", unit: "montagens por pessoa" },
    { key: "vendedores", label: "Vendedores", unit: "OS por vendedor" },
    { key: "lojas", label: "Lojas", unit: "OS por loja" },
  ];

  return (
    <form
      className="grid gap-4 rounded-xl border border-[#e2e7e9] bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const value: RankingSettings = { premios: prizes.map((item) => item.trim()), metas, rotacao: rotation };
        startTransition(async () => {
          const result = await saveSetting("ranking", value);
          if (!result.ok) return setError(result.message ?? "Não foi possível salvar.");
          setError(null);
          router.refresh();
          onDone();
        });
      }}
    >
      <div>
        <h2 className="text-[15px] font-semibold">Prêmios do pódio</h2>
        <p className="text-xs text-[#6e7c7a]">Aparecem em cima de cada lugar. Deixe em branco para não mostrar.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {prizes.map((prize, index) => (
            <label key={index} className="grid gap-1 text-sm">
              <span className="font-medium text-[#44524f]">{index + 1}º lugar</span>
              <input
                value={prize}
                maxLength={40}
                onChange={(event) => setPrizes((list) => list.map((item, position) => (position === index ? event.target.value : item)))}
                placeholder={["Ex.: folga no sábado", "Ex.: vale-lanche", "Ex.: R$ 50"][index]}
                className="h-9 rounded-lg border border-[#cdd5d8] px-3 outline-none focus:border-[#0e6b62]"
              />
            </label>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-[15px] font-semibold">Metas de {PERIOD_LABEL[period].toLowerCase()}</h2>
        <p className="text-xs text-[#6e7c7a]">Com meta, cada linha mostra a barra de progresso e quanto falta. Troque o período acima para definir as outras metas.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {boardsForGoal.map((item) => (
            <label key={item.key} className="grid gap-1 text-sm">
              <span className="font-medium text-[#44524f]">{item.label}</span>
              <input
                type="number"
                min={0}
                value={metas[item.key]?.[period] ?? ""}
                onChange={(event) => {
                  const number = event.target.value === "" ? undefined : Math.max(0, Number(event.target.value));
                  setMetas((current) => ({ ...current, [item.key]: { ...(current[item.key] ?? {}), [period]: number } }));
                }}
                placeholder="Sem meta"
                className="tabular h-9 rounded-lg border border-[#cdd5d8] px-3 outline-none focus:border-[#0e6b62]"
              />
              <span className="text-xs text-[#6e7c7a]">{item.unit}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="grid max-w-xs gap-1 text-sm">
        <span className="font-medium text-[#44524f]">Modo TV troca de quadro a cada</span>
        <select
          value={rotation}
          onChange={(event) => setRotation(Number(event.target.value))}
          className="h-9 rounded-lg border border-[#cdd5d8] px-2.5"
        >
          {ROTATIONS.map((value) => (
            <option key={value} value={value}>
              {value < 60 ? `${value} segundos` : `${value / 60} minuto${value > 60 ? "s" : ""}`}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar prêmios e metas"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Fechar</Button>
      </div>
      <Feedback error={error} />
    </form>
  );
}
