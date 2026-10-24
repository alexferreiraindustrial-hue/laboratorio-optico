import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="text-xl font-semibold">Registro não encontrado</h1>
      <p className="mt-2 text-sm text-[#6e7c7a]">O item não existe ou seu perfil não pode vê-lo.</p>
      <Link className="mt-4 inline-block text-sm text-[#0e6b62] underline" href="/dashboard">Voltar ao dashboard</Link>
    </main>
  );
}
