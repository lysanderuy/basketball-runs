import { BottomNav } from "@/components/ui/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { getRunByCode } from "@/services/runs";

export const dynamic = "force-dynamic";

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  const run = await getRunByCode(code);
  const isHost = !!userId && !!run && run.hostId === userId;

  return (
    <div className="app-shell h-dvh overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
      <BottomNav isHost={isHost} />
    </div>
  );
}
