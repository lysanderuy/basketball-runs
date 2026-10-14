import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardClient
      initialUser={{ id: user.id, email: user.email ?? "", metadata: user.user_metadata }}
    />
  );
}
