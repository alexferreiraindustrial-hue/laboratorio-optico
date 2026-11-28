"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSellerWhatsapp } from "@/server/contact-actions";
import { formatPhone, phoneDigits, validPhone } from "@/lib/domain/client-contact";
import { Button } from "./ui";

type Seller = { id: string; name: string; whatsapp: string | null; phone: string | null };

/** Lista simples: nome da vendedora e o WhatsApp que recebe os avisos. */
export function SellerContacts({ sellers }: { sellers: Seller[] }) {
  const missing = sellers.filter((seller) => !validPhone(seller.whatsapp || seller.phone)).length;
  return (
    <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" open={missing > 0}>
      <summary className="cursor-pointer text-sm font-semibold">
        WhatsApp das vendedoras {missing ? `· ${missing} sem número` : "· todas cadastradas"}
      </summary>
      <ul className="mt-3 grid gap-2">
        {sellers.map((seller) => <SellerRow key={seller.id} seller={seller} />)}
        {!sellers.length ? <li className="text-sm text-[var(--muted)]">Nenhuma vendedora ativa.</li> : null}
      </ul>
    </details>
  );
}

function SellerRow({ seller }: { seller: Seller }) {
  const router = useRouter();
  const saved = seller.whatsapp || seller.phone;
  const [value, setValue] = useState(saved ? formatPhone(saved) : "");
  const [pending, start] = useTransition();
  const changed = phoneDigits(value) !== phoneDigits(saved);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="min-w-36 flex-1 text-sm font-medium">{seller.name}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="tel"
        placeholder="(12) 99999-9999"
        aria-label={`WhatsApp de ${seller.name}`}
        className="min-h-11 w-44 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-base"
      />
      <Button
        variant="secondary"
        disabled={pending || !changed || (!!phoneDigits(value) && !validPhone(value))}
        onClick={() => start(async () => {
          const result = await saveSellerWhatsapp(seller.id, value);
          if (!result.ok) return void toast.error(result.message);
          toast.success(`${seller.name}: ${result.message}`);
          router.refresh();
        })}
      >
        Salvar
      </Button>
    </li>
  );
}
