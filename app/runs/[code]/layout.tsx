export default async function RunLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // TODO: fetch run by code, validate exists, provide RunContext
  void code;
  return <>{children}</>;
}
