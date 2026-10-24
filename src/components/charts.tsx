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

const colors = ["#0e6b62", "#1e4d9b", "#c8881a", "#b42318", "#5a3d86", "#3d4b5c", "#1d6b45", "#8a5a12"];

export function ProductionChart({
  data,
  title,
}: {
  title: string;
  data: { label: string; produced: number; goal: number | null }[];
}) {
  return (
    <article className="rounded-lg border border-[#e2e7e9] bg-white p-3">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#e2e7e9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="produced" name="Produção" fill="#0e6b62" radius={[3, 3, 0, 0]} />
            <Bar dataKey="goal" name="Meta" fill="#c5d5d2" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function MonthlyLine({ data }: { data: { label: string; produced: number }[] }) {
  return (
    <article className="rounded-lg border border-[#e2e7e9] bg-white p-3">
      <h2 className="mb-2 text-sm font-medium">Evolução mensal da produção</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e7e9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line dataKey="produced" name="Produção" stroke="#0e6b62" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <article className="rounded-lg border border-[#e2e7e9] bg-white p-3">
      <h2 className="mb-2 text-sm font-medium">Ordens por status</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={78}>
              {data.map((item, index) => (
                <Cell key={item.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function CategoryBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <article className="rounded-lg border border-[#e2e7e9] bg-white p-3">
      <h2 className="mb-2 text-sm font-medium">Ocorrências por categoria</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke="#e2e7e9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" name="Ocorrências" fill="#8a5a12" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
