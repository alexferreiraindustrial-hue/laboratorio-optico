import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/domain/constants";
import type { Profile } from "@/lib/types";

export const getSession = cache(async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    supabase,
    user: data.user,
    profile: profile as Profile | null,
  };
});

export async function requireProfile() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!session.profile?.active) redirect("/login?inativo=1");
  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
    role: session.profile.role as AppRole,
  };
}

export function actionError(error: { message: string } | null, fallback: string) {
  if (!error) return null;
  const message = error.message.replace(/^.*ERROR:\s*/i, "");
  return message || fallback;
}
