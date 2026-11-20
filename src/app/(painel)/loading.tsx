function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#e2ddd5] ${className}`} />;
}

export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="h-0.5 w-full overflow-hidden rounded bg-[#f3ece2]">
        <div className="h-full w-1/3 animate-[loadbar_1s_ease-in-out_infinite] bg-[#8c6239]" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-2">
          <Bar className="h-7 w-56" />
          <Bar className="h-4 w-80 max-w-full" />
        </div>
        <Bar className="h-9 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid gap-3 rounded-xl border border-[#e2ddd5] bg-white p-4">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-2 rounded-xl border border-[#e2ddd5] bg-white p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-1.5">
            <Bar className="h-4 w-28" />
            <Bar className="h-4 flex-1" />
            <Bar className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
