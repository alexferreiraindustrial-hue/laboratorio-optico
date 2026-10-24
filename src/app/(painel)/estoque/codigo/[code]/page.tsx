import Link from "next/link";
import { redirect } from "next/navigation";
import { isPublicCode } from "@/lib/domain/qr";
import { requireProfile } from "@/server/session";

export default async function StockCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = decodeURIComponent(code).toUpperCase();
  if (!isPublicCode(normalized)) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Código não reconhecido</h1>
        <p className="mt-2 text-sm text-[#6e7c7a]">O valor lido não é um identificador de estoque deste laboratório. Nenhuma lente foi identificada.</p>
        <Link className="mt-4 inline-block text-sm text-[#0e6b62] underline" href="/estoque/leitura">Tentar novamente</Link>
      </div>
    );
  }
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("lens_prescription_stock").select("id").eq("public_code", normalized).maybeSingle();
  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Código sem cadastro</h1>
        <p className="mt-2 text-sm text-[#6e7c7a]">O identificador {normalized} é válido no formato, mas não existe no estoque. Nenhuma lente foi identificada.</p>
        <Link className="mt-4 inline-block text-sm text-[#0e6b62] underline" href="/estoque/leitura">Nova leitura</Link>
      </div>
    );
  }
  redirect(`/estoque/${data.id}`);
}
