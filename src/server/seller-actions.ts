"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loginSellerApp, sendPortalMessage } from "./portal";
import { SELLER_COOKIE, sellerCookieOptions, sellerSession } from "./seller-session";

export async function sellerSignIn(formData: FormData) {
  const result = await loginSellerApp(String(formData.get("login") ?? ""), String(formData.get("pin") ?? ""));
  if (!result.ok) return result;
  (await cookies()).set(SELLER_COOKIE, result.token, sellerCookieOptions());
  return { ok: true as const };
}

export async function sellerSignOut() {
  (await cookies()).set(SELLER_COOKIE, "", { ...sellerCookieOptions(), maxAge: 0 });
  redirect("/vendedor/login");
}

export async function submitSellerSessionMessage(formData: FormData) {
  const session = await sellerSession();
  if (session.error) return { ok: false as const, message: session.error };
  const orderId = String(formData.get("orderId") ?? "");
  const result = await sendPortalMessage(session.token, orderId, String(formData.get("body") ?? ""));
  if (result.ok) revalidatePath(`/vendedor/os/${orderId}`);
  return result;
}
