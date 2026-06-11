"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";

export type QueueEntry = {
  id: string;
  displayName: string;
  status: "waiting" | "marked_out" | "removed";
  gamesPlayed: number;
};

export type QueueData = {
  onCourt: QueueEntry[];
  waiting: QueueEntry[];
};

export function useQueue(code: string) {
  return useQuery({
    queryKey: ["queue", code],
    queryFn: () => apiGet<QueueData>(`/api/runs/${code}/queue`),
  });
}

export function useUpdateQueueStatusMutation(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entryId: string;
      status: "waiting" | "marked_out" | "removed";
    }) =>
      apiPatch(`/api/runs/${code}/queue/${input.entryId}`, { status: input.status }),
    // Realtime is the fast path; this is the seatbelt for flaky court wifi or
    // a dead websocket — refetch the queue so the host's screen reflects the
    // server truth even when the realtime push never arrived.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue", code] });
    },
  });
}

export function useAddQueueEntryMutation(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) =>
      apiPost<{ position: number }>(`/api/runs/${code}/queue`, { displayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue", code] });
    },
  });
}
