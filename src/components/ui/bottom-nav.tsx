"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function BottomNav({ isHost = false }: { isHost?: boolean }) {
  const pathname = usePathname();
  const match = pathname.match(/^\/runs\/([^/]+)/);
  const code = match?.[1] ?? "";

  const tabs = [
    {
      href: `/runs/${code}/feed`,
      label: "Feed",
      active: pathname.includes("/feed"),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      href: `/runs/${code}/queue`,
      label: "Queue",
      active: pathname.includes("/queue"),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    ...(isHost ? [{
      href: `/runs/${code}/payment`,
      label: "Payment",
      active: pathname.includes("/payment"),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    }] : []),
  ];

  return (
    <nav
      className="flex-shrink-0 flex items-center border-t border-border bg-bg-raised px-2 h-[58px]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-[3px] py-2 transition-colors",
            tab.active ? "text-accent" : "text-text-muted hover:text-text-secondary"
          )}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {tab.icon}
          <span className="font-display text-[10px] font-bold tracking-[0.1em] uppercase">
            {tab.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
