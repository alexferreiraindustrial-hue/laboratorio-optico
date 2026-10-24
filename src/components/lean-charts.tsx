"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ControlPoint, ParetoItem } from "@/lib/domain/lean";

const ACCENT = "#0e6b62";
const AMBER = "#c8881a";
const RED = "#b42318";
const GRID = "#e2e7e9";
const tick = { fontSize: 11, fill: "#6e7c7a" };
const tooltipStyle = { borderRadius: 10, border: "1px solid #e2e7e9", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(19,32,31,.25)" };


export function ParetoChart({ data }: { data: ParetoItem[] }) {
  const rows = data.slice(0, 8).map((item) => ({
    ...item,
    short: item.name.length > 16 ? `${item.name.slice(0, 15)}…` : item.name,
    cumulativePct: Math.round(item.cumulative * 100),
  }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="short" tick={tick} interval={0} angle={-18} textAnchor="end" height={56} />
          <YAxis yAxisId="n" allowDecimals={false} tick={tick} />
          <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={tick} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => (name === "Acumulado" ? `${value}%` : value)}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
          />
          <ReferenceLine yAxisId="p" y={80} stroke={AMBER} strokeDasharray="4 4" label={{ value: "80%", position: "insideTopRight", fontSize: 11, fill: AMBER }} />
          <Bar yAxisId="n" dataKey="count" name="Ocorrências" radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.name} fill={row.vital ? ACCENT : "#b8cfcb"} />
            ))}
          </Bar>
          <Line yAxisId="p" dataKey="cumulativePct" name="Acumulado" stroke={AMBER} strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ControlChart({ data }: { data: ControlPoint[] }) {
  const rows = data.map((point) => ({
    ...point,
    value: Number(point.value.toFixed(3)),
    ucl: Number(point.ucl.toFixed(3)),
    cl: Number(point.cl.toFixed(3)),
    lcl: Number(point.lcl.toFixed(3)),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tick} minTickGap={16} />
          <YAxis tick={tick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line dataKey="ucl" name="LSC" stroke={RED} strokeDasharray="5 4" dot={false} strokeWidth={1.5} type="stepAfter" />
          <Line dataKey="cl" name="Média (ū)" stroke="#8a9694" dot={false} strokeWidth={1.5} />
          <Line dataKey="lcl" name="LIC" stroke={RED} strokeDasharray="5 4" dot={false} strokeWidth={1.5} type="stepAfter" />
          <Line
            dataKey="value"
            name="Defeitos por OS"
            stroke={ACCENT}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: ControlPoint; index: number };
              return <circle key={index} cx={cx} cy={cy} r={payload.out ? 5 : 3} fill={payload.out ? RED : ACCENT} stroke="white" strokeWidth={1.5} />;
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CycleBars({ data, takt, bottleneck }: { data: { key: string; label: string; minutes: number | null }[]; takt: number | null; bottleneck: string | null }) {
  const rows = data.map((row) => ({ ...row, minutes: row.minutes === null ? 0 : Number(row.minutes.toFixed(1)) }));
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={tick} unit=" min" />
          <YAxis type="category" dataKey="label" tick={tick} width={128} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value} min`} />
          {takt ? <ReferenceLine x={Number(takt.toFixed(1))} stroke={AMBER} strokeDasharray="4 4" label={{ value: "takt", position: "top", fontSize: 11, fill: AMBER }} /> : null}
          <Bar dataKey="minutes" name="Tempo médio" radius={[0, 4, 4, 0]}>
            {rows.map((row) => (
              <Cell key={row.key} fill={row.key === bottleneck ? RED : ACCENT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FiveSRadar({ series }: { series: { name: string; color: string; values: Record<string, number> }[] }) {
  const axes = [
    { key: "seiri", label: "Seiri" },
    { key: "seiton", label: "Seiton" },
    { key: "seiso", label: "Seiso" },
    { key: "seiketsu", label: "Seiketsu" },
    { key: "shitsuke", label: "Shitsuke" },
  ];
  const rows = axes.map((axis) => ({ axis: axis.label, ...Object.fromEntries(series.map((item) => [item.name, item.values[axis.key] ?? 0])) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={rows} outerRadius="72%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: "#44524f", fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 10, fill: "#8a9694" }} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          {series.map((item) => (
            <Radar key={item.name} name={item.name} dataKey={item.name} stroke={item.color} fill={item.color} fillOpacity={0.18} strokeWidth={2} />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Spark({ values, color = ACCENT }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const rows = values.map((value, index) => ({ index, value: Math.round(value * 100) }));
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <YAxis hide domain={[0, 100]} />
          <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FlowTrend({ data }: { data: { label: string; done: number; defects: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tick} minTickGap={16} />
          <YAxis allowDecimals={false} tick={tick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="done" name="OS prontas" fill={ACCENT} radius={[3, 3, 0, 0]} />
          <Line dataKey="defects" name="Ocorrências" stroke={RED} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

