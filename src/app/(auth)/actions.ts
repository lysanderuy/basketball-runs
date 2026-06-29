"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getValidInvite } from "@/services/invite.service";

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

  const invite = formData.get("invite") as string | null;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = (formData.get("displayName") as string).trim();

  // Re-validate the invite server-side — never trust the page's gate.
  if (!invite) {
    return { error: "An invitation is required to create an account." };
  }
  let invitedEmail: string;
  try {
    ({ email: invitedEmail } = await getValidInvite(invite));
  } catch {
    return { error: "This invitation is no longer valid. Please request a new one." };
  }
  // Email-binding is enforced here, before any account is created — the page's
  // readOnly field is cosmetic and a crafted request could submit any email.
  if (invitedEmail.toLowerCase() !== email.toLowerCase()) {
    return { error: "This invitation was issued for a different email address." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { displayName } },
  });

  // The invite is consumed by the BEFORE INSERT trigger on auth.users, so a
  // successful signup spends it even before email confirmation. Only failures
  // here (before the row is inserted) leave the invite reusable.
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
