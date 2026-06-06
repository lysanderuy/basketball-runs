"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useQueueRealtime(runId: string | null, refetch: () => void) {
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!runId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`queue-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `run_id=eq.${runId}` },
        () => refetchRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `run_id=eq.${runId}` },
        () => refetchRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId]);
}
