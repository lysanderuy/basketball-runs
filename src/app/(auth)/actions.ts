"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect(next);
}

export async function signUp(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = (formData.get("displayName") as string).trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { displayName } },
  });

  if (error) return { error: error.message };

  // With email confirmation enabled Supabase returns no session — the user
  // must verify before signing in, so route them to the check-your-email screen.
  // The welcome email is sent on confirmation (auth callback), not here.
  if (!data.session) {
    redirect(`/signup/confirm?email=${encodeURIComponent(email)}`);
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
