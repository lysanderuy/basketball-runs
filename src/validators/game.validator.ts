import { z } from "zod";

export const createGameSchema = z.object({
  teamA: z.array(z.string().uuid()).min(1),
  teamB: z.array(z.string().uuid()).min(1),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;

export const clockActionSchema = z.object({
  action: z.enum(["start", "pause", "resume"]),
});

export type ClockActionInput = z.infer<typeof clockActionSchema>;
