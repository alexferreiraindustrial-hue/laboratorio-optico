"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEW_MODE_COOKIE } from "./view-mode";

/** Alterna entre o modo simples (botões grandes) e o painel completo. */
export async function setViewMode(formData: FormData) {
  const mode = formData.get("modo") === "simples" ? "simples" : "completo";
  (await cookies()).set(VIEW_MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect(mode === "simples" ? "/inicio" : "/dashboard");
}
