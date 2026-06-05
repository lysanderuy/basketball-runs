import { BottomNav } from "@/components/ui/bottom-nav";

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
