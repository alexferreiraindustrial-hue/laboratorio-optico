import { cookies } from "next/headers";
import type { AppRole } from "@/lib/domain/constants";

export const VIEW_MODE_COOKIE = "lab_modo";

/** Perfis que já abrem no modo simples quando a pessoa ainda não escolheu. */
const SIMPLE_BY_DEFAULT: AppRole[] = ["montador", "estoquista"];

export async function isSimpleMode(role: AppRole) {
  const value = (await cookies()).get(VIEW_MODE_COOKIE)?.value;
  if (value === "simples") return true;
  if (value === "completo") return false;
  return SIMPLE_BY_DEFAULT.includes(role);
}
