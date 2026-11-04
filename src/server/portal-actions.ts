"use server";

import { revalidatePath } from "next/cache";
import { loginSellerApp, sendPortalMessage } from "./portal";

export async function submitSellerAppLogin(formData: FormData) {
  return loginSellerApp(String(formData.get("login") ?? ""), String(formData.get("pin") ?? ""));
}

export async function submitPortalMessage(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const kind = String(formData.get("kind") ?? "loja");
  const result = await sendPortalMessage(token, orderId, String(formData.get("body") ?? ""));
  if (result.ok) revalidatePath(`/acompanhar/${kind}/${token}/os/${orderId}`);
  return result;
}
