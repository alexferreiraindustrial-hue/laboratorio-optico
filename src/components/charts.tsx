"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const colors = ["var(--link)", "var(--link)", "var(--warning)", "var(--danger)", "var(--fg-5a3d86)", "var(--fg-3d4b5c)", "var(--ok)", "var(--warning)"];

export function ProductionChart({
  data,
  title,
}: {
  title: string;
  data: { label: string; produced: number; goal: number | null }[];
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <Tooltip contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }} itemStyle={{color: "var(--ink)"}} labelStyle={{color: "var(--ink)"}} />
            <Legend />
            <Bar dataKey="produced" name="Produção" fill="var(--link)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="goal" name="Meta" fill="#c5d5d2" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function MonthlyLine({ data }: { data: { label: string; produced: number }[] }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <h2 className="mb-2 text-sm font-medium">Evolução mensal da produção</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <Tooltip contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }} itemStyle={{color: "var(--ink)"}} labelStyle={{color: "var(--ink)"}} />
            <Line dataKey="produced" name="Produção" stroke="var(--link)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <h2 className="mb-2 text-sm font-medium">Ordens por status</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={78}>
              {data.map((item, index) => (
                <Cell key={item.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }} itemStyle={{color: "var(--ink)"}} labelStyle={{color: "var(--ink)"}} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function CategoryBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <h2 className="mb-2 text-sm font-medium">Ocorrências por categoria</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke="var(--line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <Tooltip contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" }} itemStyle={{color: "var(--ink)"}} labelStyle={{color: "var(--ink)"}} />
            <Bar dataKey="value" name="Ocorrências" fill="var(--warning)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
