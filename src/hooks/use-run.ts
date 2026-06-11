"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import type { RunWire } from "@/types/api";

export type RunSummary = {
  id: string;
  hostId: string;
  name: string;
  location: string | null;
  status: "lobby" | "active" | "completed";
  sessionCode: string;
  createdAt: string;
  gameCount: number;
  isHost: boolean;
};

export type CreateRunPayload = {
  name: string;
  location: string;
  format: "winner_stays" | "new_ten";
  scoreGoal: number;
  pointSystem: "one_two" | "two_three";
  sessionCode: string;
  timeLimitSeconds?: number;
};

export function useRun(code: string) {
  return useQuery({
    queryKey: ["run", code],
    queryFn: () => apiGet<RunWire>(`/api/runs/${code}`),
  });
}

export function useRuns(enabled: boolean = true) {
  return useQuery({
    queryKey: ["runs"],
    queryFn: () => apiGet<RunSummary[]>(`/api/runs`),
    enabled,
  });
}

export function useCreateRunMutation() {
  return useMutation({
    mutationFn: (input: CreateRunPayload) =>
      apiPost<{ sessionCode: string }>("/api/runs", input),
  });
}

export function useCloseRunMutation(code: string) {
  return useMutation({
    mutationFn: () => apiPatch(`/api/runs/${code}/status`, { status: "completed" }),
  });
}
