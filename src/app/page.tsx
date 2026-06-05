import { createClient } from "@/lib/supabase/server";
import { getRunsForUser } from "@/services/runs";
import HomeClient, { type HomeAuthState } from "./HomeClient";

export const dynamic = "force-dynamic";

function deriveInitials(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): string {
  const name =
    (metadata?.display_name as string | undefined) ||
    (metadata?.full_name as string | undefined) ||
    "";
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return (email ?? "").slice(0, 2).toUpperCase() || "??";
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <HomeClient initialAuth={{ status: "signed-out" }} />;
  }

  const runs = await getRunsForUser(user.id);
  const initials = deriveInitials(user.user_metadata, user.email);

  const auth: HomeAuthState = {
    status: "signed-in",
    initials,
    email: user.email ?? "",
    runs: runs.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      status: r.status,
      sessionCode: r.sessionCode,
      gameCount: r.gameCount,
    })),
  };

  return <HomeClient initialAuth={auth} />;
}
