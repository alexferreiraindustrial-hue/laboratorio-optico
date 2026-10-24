import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession } from "@/server/session";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="text-sm font-medium text-[#0e6b62]">Laboratório Óptico</p>
        <h1 className="mt-2 text-2xl font-semibold">Conecte o banco antes de operar</h1>
        <p className="mt-3 text-sm leading-6 text-[#6e7c7a]">
          O sistema não usa armazenamento local para ordens, estoque ou usuários. Crie um projeto no Supabase,
          execute as migrations em <span className="font-mono">supabase/migrations</span> e preencha o arquivo
          <span className="font-mono"> .env.local</span> com a URL e a chave anônima. O passo a passo está no README.
        </p>
      </main>
    );
  }

  const { user } = await getSession();
  redirect(user ? "/dashboard" : "/login");
}
