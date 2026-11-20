import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadPortalIdentity } from "./portal";

export const SELLER_COOKIE = "oticahub-seller-access";

export const sellerCookieOptions = () => ({
  path: "/vendedor", httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 7,
});

export async function sellerSession() {
  const token = (await cookies()).get(SELLER_COOKIE)?.value;
  if (!token) redirect("/vendedor/login");
  const identity = await loadPortalIdentity(token);
  return { token, name: identity.name, error: identity.error || (identity.kind !== "seller" ? "Este acesso não é de um vendedor." : null) };
}
