import { createClient } from "@/lib/supabase/server";
import { getRunsForUser } from "@/services/runs";
import { deriveInitials } from "@/lib/utils";
import HomeClient, { type HomeAuthState } from "@/components/HomeClient";

export const dynamic = "force-dynamic";

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
