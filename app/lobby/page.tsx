import { LobbyHost } from "@/components/screens/LobbyHost";

export default async function LobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <LobbyHost code={code} />;
}
