"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { sessionCookieOptions } from "./cookie-options";

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: sessionCookieOptions(),
  });
}
