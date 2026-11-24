"use client";

import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const KANBAN_AUTO_SCROLL = {
  threshold: { x: 0.15, y: 0.12 },
  acceleration: 8,
  order: 0 as const,
  canScroll: (element: Element) =>
    element.hasAttribute("data-kanban-scroller") ||
    element.hasAttribute("data-kanban-column-body"),
};

export type KanbanLaneLink = { id: string; label: string; count: number };
export type KanbanViewportHandle = { goTo: (id: string) => void };

/** Navigation changes the viewport only. Service movement remains with each board's DndContext. */
export const KanbanViewport = forwardRef<
  KanbanViewportHandle,
  {
    label: string;
    lanes: KanbanLaneLink[];
    children: ReactNode;
    dragging?: boolean;
    preview?: boolean;
  }
>(function KanbanViewport(
  { label, lanes, children, dragging = false, preview = false },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const pan = useRef<{ id: number; x: number; left: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [position, setPosition] = useState({
    previous: false,
    next: false,
    first: 0,
    last: 0,
  });
  const id = useId();
  const laneIds = lanes.map((lane) => lane.id).join("|");

  const columns = useCallback(
    () =>
      Array.from(
        scroller.current?.querySelectorAll<HTMLElement>(
          ":scope > [data-kanban-column]",
        ) ?? [],
      ),
    [],
  );
  const measure = useCallback(() => {
    const host = scroller.current;
    if (!host) return;
    const bounds = host.getBoundingClientRect();
    const shown = columns()
      .map((node, index) => ({ index, bounds: node.getBoundingClientRect() }))
      .filter(
        (item) =>
          Math.min(bounds.right, item.bounds.right) -
            Math.max(bounds.left, item.bounds.left) >
          24,
      );
    const next = {
      previous: host.scrollLeft > 3,
      next: host.scrollLeft + host.clientWidth < host.scrollWidth - 3,
      first: shown[0]?.index ?? 0,
      last: shown.at(-1)?.index ?? 0,
    };
    setPosition((old) =>
      Object.keys(next).every(
        (key) =>
          old[key as keyof typeof old] === next[key as keyof typeof next],
      )
        ? old
        : next,
    );
  }, [columns]);

  const offset = useCallback((node: HTMLElement) => {
    const host = scroller.current!;
    return Math.max(
      0,
      Math.min(
        host.scrollWidth - host.clientWidth,
        host.scrollLeft +
          node.getBoundingClientRect().left -
          host.getBoundingClientRect().left -
          host.clientLeft -
          parseFloat(getComputedStyle(host).paddingLeft || "0"),
      ),
    );
  }, []);

  const goTo = useCallback(
    (lane: string) => {
      const host = scroller.current;
      const node = columns().find((node) => node.dataset.kanbanColumn === lane);
      if (host && node) {
        host.scrollTo({ left: offset(node), behavior: "instant" });
        node
          .querySelector<HTMLElement>(
            "[data-kanban-column-body],.kanban-column-strip",
          )
          ?.focus({ preventScroll: true });
      }
    },
    [columns, offset],
  );
  useImperativeHandle(ref, () => ({ goTo }), [goTo]);

  const move = useCallback(
    (direction: -1 | 1) => {
      const host = scroller.current;
      if (!host) return;
      const stops = columns().map(offset);
      const left =
        direction > 0
          ? (stops.find((left) => left > host.scrollLeft + 48) ??
            host.scrollWidth)
          : (stops.reverse().find((left) => left < host.scrollLeft - 48) ?? 0);
      const maximum = host.scrollWidth - host.clientWidth;
      const target =
        direction > 0 && maximum - left < 48
          ? maximum
          : direction < 0 && left < 48
            ? 0
            : left;
      host.scrollTo({ left: target, behavior: "instant" });
    },
    [columns, offset],
  );

  useEffect(() => {
    const host = scroller.current;
    if (!host) return;
    const resize = new ResizeObserver(measure);
    resize.observe(host);
    columns().forEach((node) => resize.observe(node));
    host.addEventListener("scroll", measure, { passive: true });
    // Shift + wheel pans the board; a normal wheel keeps the independent column scroll.
    const wheel = (event: WheelEvent) => {
      if (
        !event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? host.clientWidth
            : 1);
      const target = Math.max(
        0,
        Math.min(host.scrollWidth - host.clientWidth, host.scrollLeft + delta),
      );
      if (Math.abs(target - host.scrollLeft) < 1) return;
      event.preventDefault();
      host.scrollLeft = target;
    };
    host.addEventListener("wheel", wheel, { passive: false });
    measure();
    return () => {
      resize.disconnect();
      host.removeEventListener("scroll", measure);
      host.removeEventListener("wheel", wheel);
    };
  }, [laneIds, columns, measure]);

  function endPan() {
    const current = pan.current;
    if (current && scroller.current?.hasPointerCapture(current.id))
      scroller.current.releasePointerCapture(current.id);
    pan.current = null;
    setPanning(false);
  }

  return (
    <div
      className="kanban-viewport"
      data-kanban-viewport
      data-preview={preview || undefined}
      data-dragging={dragging || undefined}
    >
      <div className="kanban-toolbar">
        <label className="kanban-jump">
          <span className="sr-only">Ir para etapa do {label}</span>
          <select
            aria-controls={id}
            value=""
            onChange={(event) => goTo(event.target.value)}
          >
            <option value="">Ir para etapa…</option>
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.label} · {lane.count}
              </option>
            ))}
          </select>
        </label>
        <span className="kanban-position" aria-live="polite">
          {lanes.length
            ? `${position.first + 1}${position.last !== position.first ? `–${position.last + 1}` : ""} de ${lanes.length} etapas`
            : "Sem etapas"}
        </span>
        <div
          className="kanban-arrows"
          role="group"
          aria-label={`Navegar pelo ${label}`}
        >
          <button
            type="button"
            disabled={!position.previous}
            onClick={() => move(-1)}
            aria-label={`Ver colunas anteriores do ${label}`}
            aria-controls={id}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            disabled={!position.next}
            onClick={() => move(1)}
            aria-label={`Ver próximas colunas do ${label}`}
            aria-controls={id}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        id={id}
        className="kanban-scroller"
        data-kanban-scroller
        data-panning={panning || undefined}
        role="region"
        aria-label={label}
        aria-describedby={`${id}-hint`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            event.currentTarget.scrollLeft =
              event.key === "Home" ? 0 : event.currentTarget.scrollWidth;
          }
        }}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientY >=
            bounds.top +
              event.currentTarget.clientTop +
              event.currentTarget.clientHeight
          )
            return;
          if (
            dragging ||
            event.pointerType !== "mouse" ||
            event.button !== 0 ||
            !(event.target instanceof Element)
          )
            return;
          if (
            event.target.closest(
              "a,button,input,select,textarea,summary,label,[role=button],[contenteditable=true],[data-kanban-card]",
            )
          )
            return;
          pan.current = {
            id: event.pointerId,
            x: event.clientX,
            left: event.currentTarget.scrollLeft,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = pan.current;
          if (!start || start.id !== event.pointerId) return;
          const distance = event.clientX - start.x;
          if (Math.abs(distance) < 5 && !panning) return;
          event.preventDefault();
          setPanning(true);
          event.currentTarget.scrollLeft = start.left - distance;
        }}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={() => {
          pan.current = null;
          setPanning(false);
        }}
      >
        {children}
      </div>
      <p id={`${id}-hint`} className="kanban-hint">
        <MoveHorizontal size={14} aria-hidden="true" />
        <span className="kanban-desktop-hint">
          Setas ou Shift + roda para ir aos lados. Arraste o espaço vazio do
          quadro.
        </span>
        <span className="kanban-touch-hint">
          Deslize para os lados ou use as setas. Role dentro da coluna para ver
          mais serviços.
        </span>
      </p>
    </div>
  );
});
