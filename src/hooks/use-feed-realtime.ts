"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiGet } from "@/lib/api/client";
import type { GameData, GameDetails } from "@/hooks/use-game";

// Note: this hook and useQueueRealtime/useGameRealtime both subscribe to tables
// scoped to the same run/game. Today only one is mounted at a time
// (queue/game/feed are different routes), but mounting both on the same page
// will create duplicate channels. Don't co-locate.

// Feed uses setQueryData for the games channel (no refetch — avoids the
// concurrent-fetch race where a slower older fetch resolves after a newer one
// and overwrites state). The score_events fetch lives here too, along with
// its stale-response guard — splitting them apart re-introduces the bug.

export function useFeedRealtime(
  runId: string | null,
  code: string,
  activeGameId: string | null,
  onLastScorer: (displayName: string) => void,
) {
  const queryClient = useQueryClient();
  const onLastScorerRef = useRef(onLastScorer);
  useEffect(() => {
    onLastScorerRef.current = onLastScorer;
  }, [onLastScorer]);

  // games UPDATE — apply payload directly to ["games", code]
  useEffect(() => {
    if (!runId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`feed-${runId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "games", filter: `run_id=eq.${runId}` },
        () => queryClient.invalidateQueries({ queryKey: ["games", code] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `run_id=eq.${runId}` },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          queryClient.setQueryData<GameData[]>(["games", code], (prev) =>
            prev?.map((g) =>
              g.id === r.id
                ? {
                    ...g,
                    status: r.status as GameData["status"],
                    scoreA: r.score_a as number,
                    scoreB: r.score_b as number,
                    winner: r.winner as GameData["winner"],
                    timeLimitSeconds: r.time_limit_seconds as number | null,
                    clockStartedAt: r.clock_started_at as string | null,
                    clockPausedAt: r.clock_paused_at as string | null,
                    totalPausedSeconds: r.total_paused_seconds as number,
                    startedAt: r.started_at as string | null,
                    endedAt: r.ended_at as string | null,
                  }
                : g,
            ),
          );
          // Game completion changes the top-scorer cache (a freshly-completed
          // game appears for the first time). Refetch the aggregated per-run
          // list rather than mutating it row-by-row.
          queryClient.invalidateQueries({ queryKey: ["top-scorers", code] });
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.error(`Realtime channel feed-${runId} failed:`, status);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId, code, queryClient]);

  // score_events INSERT — fetch details, get last event, emit scorer name.
  // Stale-response guard (lastScorerGenRef) prevents a slower older fetch
  // from overwriting a newer one.
  useEffect(() => {
    if (!activeGameId) return;
    const gameId = activeGameId;
    let gen = 0;
    const supabase = createClient();
    const channel = supabase
      .channel(`feed-scores-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "score_events", filter: `game_id=eq.${gameId}` },
        async () => {
          const myGen = ++gen;
          try {
            const details = await apiGet<GameDetails>(`/api/runs/${code}/games/${gameId}`);
            if (myGen !== gen) return; // stale response
            const last = details.recentEvents?.[0];
            if (last) onLastScorerRef.current(last.displayName);
          } catch {
            // Swallow — the realtime channel will retry on the next score event.
          }
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.error(`Realtime channel feed-scores-${gameId} failed:`, status);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGameId, code]);
}
