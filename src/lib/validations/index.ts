import { z } from "zod";

// ─── Runs ─────────────────────────────────────────────────────────────────────

export const createRunSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  format: z.enum(["winner_stays", "new_ten", "host_decides"]),
  scoreGoal: z.number().int().min(1).max(100),
  timeLimitSeconds: z.number().int().min(60).max(3600).optional(),
  sessionCode: z.string().regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;

// ─── Queue Entries ────────────────────────────────────────────────────────────

export const joinRunSchema = z.object({
  displayName: z.string().min(1).max(50).transform((s) => s.trim()),
});

export type JoinRunInput = z.infer<typeof joinRunSchema>;

export const reorderQueueSchema = z.object({
  entryId: z.string().uuid(),
  afterEntryId: z.string().uuid().nullable(),
});

export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;

export const updateQueueEntryStatusSchema = z.object({
  status: z.enum(["waiting", "marked_out", "removed"]),
});

export type UpdateQueueEntryStatusInput = z.infer<typeof updateQueueEntryStatusSchema>;

// ─── Games ────────────────────────────────────────────────────────────────────

export const createGameSchema = z.object({
  teamA: z.array(z.string().uuid()).min(1),
  teamB: z.array(z.string().uuid()).min(1),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;

export const clockActionSchema = z.object({
  action: z.enum(["start", "pause", "resume"]),
});

export type ClockActionInput = z.infer<typeof clockActionSchema>;

// ─── Score Events ─────────────────────────────────────────────────────────────

export const scorePointSchema = z.object({
  queueEntryId: z.string().uuid(),
  team: z.enum(["team_a", "team_b"]),
});

export type ScorePointInput = z.infer<typeof scorePointSchema>;

export const undoScoreSchema = z.object({
  eventId: z.string().uuid(),
});

export type UndoScoreInput = z.infer<typeof undoScoreSchema>;
