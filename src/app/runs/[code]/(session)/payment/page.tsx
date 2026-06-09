"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { SessionTopbar } from "@/components/ui/session-topbar";
import { createClient } from "@/lib/supabase/client";
import { useQueueRealtime } from "@/hooks/useQueueRealtime";
import type { Run, QueueEntry } from "@/types/db";

type QueueData = {
  onCourt: QueueEntry[];
  waiting: QueueEntry[];
};

export default function PaymentPage() {
  const { code } = useParams<{ code: string }>();

  const [run, setRun] = useState<Run | null>(null);
  const [queue, setQueue] = useState<QueueData>({ onCourt: [], waiting: [] });
  const [loading, setLoading] = useState(true);

  const lastTapRef = useRef<Record<string, number>>({});
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const [runRes, queueRes] = await Promise.all([
      fetch(`/api/runs/${code}`),
      fetch(`/api/runs/${code}/queue`),
    ]);
    if (runRes.ok) setRun(await runRes.json());
    if (queueRes.ok) setQueue(await queueRes.json());
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep supabaseRef in sync (needed for auth if used elsewhere, unused here but consistent)
  useEffect(() => {
    supabaseRef.current = createClient();
  }, []);

  useQueueRealtime(run?.id ?? null, load);

  const allPlayers = [
    ...queue.onCourt,
    ...queue.waiting.filter((e) => e.status !== "removed"),
  ];
  const paidCount = allPlayers.filter((e) => e.paid).length;

  function handleTap(entry: QueueEntry) {
    const now = Date.now();
    const last = lastTapRef.current[entry.id] ?? 0;
    lastTapRef.current[entry.id] = now;

    if (!entry.paid) {
      togglePaid(entry.id, true);
    } else if (now - last < 400) {
      // Double-tap on paid → undo
      lastTapRef.current[entry.id] = 0;
      togglePaid(entry.id, false);
    }
    // Single tap on paid → just record time (waiting for double-tap)
  }

  async function togglePaid(entryId: string, paid: boolean) {
    // Optimistic update
    setQueue((prev) => ({
      onCourt: prev.onCourt.map((e) => e.id === entryId ? { ...e, paid } : e),
      waiting: prev.waiting.map((e) => e.id === entryId ? { ...e, paid } : e),
    }));

    const res = await fetch(`/api/runs/${code}/queue/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });

    if (!res.ok) {
      load();
    }
  }

  return (
    <>
      <SessionTopbar
        run={run}
        loading={loading}
        badge={paidCount > 0 && !loading ? (
          <div className="flex items-center gap-[5px] font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent bg-accent-glow border border-border-accent px-2.5 py-1 rounded-[4px]">
            {paidCount} paid
          </div>
        ) : undefined}
      />

      {/* STATS STRIP */}
      {!loading && (
        <div
          className="bg-bg-surface border border-border rounded-md mx-5 mt-3.5 flex animate-fade-up"
          style={{ animationDelay: "0.04s" }}
        >
          {[
            { label: "Paid", value: paidCount, accent: true },
            { label: "Players", value: allPlayers.length, accent: false },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center gap-0.5 p-2.5 flex-1 ${i > 0 ? "border-l border-border" : ""}`}
            >
              <span
                className={`font-display text-[18px] font-black leading-none ${stat.accent ? "text-accent" : "text-text-primary"}`}
              >
                {stat.value}
              </span>
              <span className="font-display text-[10px] font-bold tracking-[0.1em] uppercase text-text-muted">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PLAYER LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
        {!loading && (
          <div
            className="px-5 pt-5 flex flex-col gap-1.5 animate-fade-up"
            style={{ animationDelay: "0.08s" }}
          >
            <div className="flex items-center justify-between pb-2">
              <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Players
              </span>
              <span className="font-display text-[10px] font-bold tracking-[0.08em] uppercase text-text-muted">
                Tap to mark paid · Double-tap to undo
              </span>
            </div>

            {allPlayers.length > 0 ? (
              allPlayers.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleTap(entry)}
                  className={`w-full rounded-md px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] border touch-manipulation ${
                    entry.paid
                      ? "bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.35)]"
                      : "bg-bg-surface border-border"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span
                    className={`font-display text-[16px] font-extrabold uppercase flex-1 truncate tracking-[0.02em] transition-colors text-left ${
                      entry.paid ? "text-[#4ade80]" : "text-text-primary"
                    }`}
                  >
                    {entry.displayName}
                  </span>
                  {entry.paid && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 text-[#4ade80] flex-shrink-0"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="px-5 py-6 bg-bg-surface border border-dashed border-border rounded-md flex flex-col items-center gap-1.5 text-center">
                <span className="font-display text-[13px] font-bold tracking-[0.08em] uppercase text-text-muted">
                  No players yet
                </span>
                <span className="font-body text-[12px] text-text-muted">
                  Players will appear here once they join
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
