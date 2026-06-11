import { z } from "zod";

export const scorePointSchema = z.object({
  queueEntryId: z.string().uuid(),
  team: z.enum(["team_a", "team_b"]),
  points: z.number().int().min(1).max(10),
});

export type ScorePointInput = z.infer<typeof scorePointSchema>;
