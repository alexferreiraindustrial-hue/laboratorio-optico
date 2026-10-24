import { StoreForm } from "@/components/party-forms";
import { PageHeading } from "@/components/shell";
import { Panel } from "@/components/ui";

export default function NewStorePage() {
  return (
    <div>
      <PageHeading title="Nova loja" description="O código da loja é gerado pelo banco." />
      <Panel className="p-4"><StoreForm /></Panel>
    </div>
  );
}
