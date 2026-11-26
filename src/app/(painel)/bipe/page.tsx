import { redirect } from "next/navigation";

/** O modo bipe agora fica dentro do PDV da produção. */
export default function BipePage() {
  redirect("/pdv");
}
