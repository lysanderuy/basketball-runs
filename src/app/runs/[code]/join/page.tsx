import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRunByCode } from "@/services/runs";
import JoinForm from "./JoinForm";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const run = await getRunByCode(code);

  if (!run) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { sub?: string; user_metadata?: { displayName?: string } }
    | null
    | undefined;

  const userId = claims?.sub ?? null;
  const displayName = claims?.user_metadata?.displayName ?? null;

  return (
    <JoinForm
      runCode={code}
      runName={run.name}
      currentUser={userId ? { id: userId, displayName } : null}
    />
  );
}
