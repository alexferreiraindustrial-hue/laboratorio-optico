import { LeanNav } from "@/components/lean-nav";
import { PageHeading } from "@/components/shell";

export default function MelhoriaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <PageHeading
        title="Melhoria contínua"
        description="5S, Kaizen, Kanban e Lean Six Sigma aplicados ao laboratório: medir, enxergar o desperdício, testar a melhoria e transformar o que funciona em padrão."
      />
      <LeanNav />
      {children}
    </div>
  );
}
