"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";

export type GameData = {
  id: string;
  gameNumber: number;
  status: "pending" | "active" | "completed";
  scoreGoal: number;
  scoreA: number;
  scoreB: number;
  winner: "team_a" | "team_b" | "tie" | null;
  timeLimitSeconds: number | null;
  clockStartedAt: string | null;
  clockPausedAt: string | null;
  totalPausedSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
};

export type PlayerData = {
  queueEntryId: string;
  displayName: string;
  team: "team_a" | "team_b";
  points: number;
};

export type EventData = {
  id: string;
  queueEntryId: string;
  displayName: string;
  team: "team_a" | "team_b";
  points: number;
  createdAt: string;
};

export type GameDetails = {
  game: GameData;
  players: PlayerData[];
  recentEvents: EventData[];
};

export function useGames(code: string) {
  return useQuery({
    queryKey: ["games", code],
    queryFn: () => apiGet<GameData[]>(`/api/runs/${code}/games`),
  });
}

export function useGameDetails(code: string, gameId: string | null) {
  return useQuery({
    queryKey: ["game", code, gameId],
    queryFn: () => apiGet<GameDetails>(`/api/runs/${code}/games/${gameId}`),
    enabled: !!gameId,
  });
}

export function useScoreMutation(code: string, gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { queueEntryId: string; team: "team_a" | "team_b"; points: number }) =>
      apiPost<EventData>(`/api/runs/${code}/games/${gameId}/score`, input),
    // Cancel any in-flight game refetch so its stale response can't land after
    // the optimistic value and snap the score back. The realtime channel and
    // the onError invalidate are the longer-term resync paths.
    onMutate: async ({ queueEntryId, team, points }) => {
      await queryClient.cancelQueries({ queryKey: ["game", code, gameId] });
      queryClient.setQueryData<GameDetails>(["game", code, gameId], (prev) => {
        if (!prev) return prev;
        const newScoreA = prev.game.scoreA + (team === "team_a" ? points : 0);
        const newScoreB = prev.game.scoreB + (team === "team_b" ? points : 0);
        const scorer = prev.players.find((p) => p.queueEntryId === queueEntryId);
        const optimisticEvent: EventData = {
          id: `optimistic-${Date.now()}`,
          queueEntryId,
          displayName: scorer?.displayName ?? "",
          team,
          points,
          createdAt: new Date().toISOString(),
        };
        return {
          ...prev,
          game: {
            ...prev.game,
            scoreA: newScoreA,
            scoreB: newScoreB,
            status: prev.game.status === "pending" ? "active" : prev.game.status,
          },
          players: prev.players.map((p) =>
            p.queueEntryId === queueEntryId ? { ...p, points: p.points + points } : p,
          ),
          recentEvents: [optimisticEvent, ...prev.recentEvents].slice(0, 10),
        };
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["game", code, gameId] });
    },
  });
}

export function useUndoScoreMutation(code: string, gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPatch<EventData>(`/api/runs/${code}/games/${gameId}/score`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["game", code, gameId] });
      queryClient.setQueryData<GameDetails>(["game", code, gameId], (prev) => {
        if (!prev || prev.recentEvents.length === 0) return prev;
        const last = prev.recentEvents[0];
        return {
          ...prev,
          game: {
            ...prev.game,
            scoreA: Math.max(0, prev.game.scoreA - (last.team === "team_a" ? last.points : 0)),
            scoreB: Math.max(0, prev.game.scoreB - (last.team === "team_b" ? last.points : 0)),
          },
          players: prev.players.map((p) =>
            p.queueEntryId === last.queueEntryId
              ? { ...p, points: Math.max(0, p.points - last.points) }
              : p,
          ),
          recentEvents: prev.recentEvents.slice(1),
        };
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["game", code, gameId] });
    },
  });
}

export function useClockMutation(code: string, gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: "start" | "pause" | "resume") => {
      const updated = await apiPatch<GameData>(`/api/runs/${code}/games/${gameId}/clock`, { action });
      queryClient.setQueryData<GameDetails>(["game", code, gameId], (prev) =>
        prev ? { ...prev, game: updated } : prev,
      );
      return updated;
    },
  });
}

export function useEndGameMutation(code: string, gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const updated = await apiPatch<GameData>(`/api/runs/${code}/games/${gameId}`);
      queryClient.setQueryData<GameDetails>(["game", code, gameId], (prev) =>
        prev ? { ...prev, game: updated } : prev,
      );
      return updated;
    },
  });
}

export function useConfirmTeamsMutation(code: string) {
  return useMutation({
    mutationFn: (input: { teamA: string[]; teamB: string[] }) =>
      apiPost<GameData>(`/api/runs/${code}/games`, input),
  });
}

export type GameTopScorer = {
  gameId: string;
  topScorer: { queueEntryId: string; displayName: string; points: number } | null;
};

export function useTopScorers(code: string) {
  return useQuery({
    queryKey: ["top-scorers", code],
    queryFn: () => apiGet<GameTopScorer[]>(`/api/runs/${code}/games/top-scorers`),
  });
}
