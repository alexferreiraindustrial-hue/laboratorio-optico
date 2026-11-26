import { code128Encodable, code128Widths } from "@/lib/domain/code128";

/** Código de barras Code 128 em SVG (imprime nítido em qualquer impressora). */
export function Barcode({ value, height = 48, module = 2, showText = true, className }: { value: string; height?: number; module?: number; showText?: boolean; className?: string }) {
  if (!code128Encodable(value)) return <p className="text-xs text-[var(--muted)]">Número com acento ou longo demais para código de barras.</p>;
  const widths = code128Widths(value);
  const quiet = 10;
  const total = widths.reduce((sum, width) => sum + width, 0) + quiet * 2;
  const textHeight = showText ? 14 : 0;
  const bars: { x: number; w: number }[] = [];
  let x = quiet;
  widths.forEach((width, index) => {
    if (index % 2 === 0) bars.push({ x, w: width });
    x += width;
  });
  return (
    <svg role="img" aria-label={`Código de barras ${value}`} className={className} viewBox={`0 0 ${total} ${height + textHeight}`} width={total * module} height={(height + textHeight) * (module / 1.5)} preserveAspectRatio="none" shapeRendering="crispEdges">
      <rect x="0" y="0" width={total} height={height + textHeight} fill="#fff" />
      {bars.map((bar) => <rect key={bar.x} x={bar.x} y="0" width={bar.w} height={height} fill="#000" />)}
      {showText ? <text x={total / 2} y={height + 11} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="#000">{value}</text> : null}
    </svg>
  );
}
