import { QrScanner } from "@/components/qr-scanner";
import { PageHeading } from "@/components/shell";

export default function LeituraPage() {
  return (
    <div>
      <PageHeading
        title="Leitura de QR Code"
        description="A consulta só abre um item depois de um identificador válido cadastrado. Uma leitura inválida não identifica lente."
      />
      <QrScanner />
    </div>
  );
}
