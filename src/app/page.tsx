import { getSessionUser } from "@/lib/supabase/server";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <HomeClient
      initialUser={user ? { id: user.id, email: user.email ?? "", metadata: user.user_metadata } : null}
    />
  );
}
