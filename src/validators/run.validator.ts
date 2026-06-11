import { z } from "zod";

export const createRunSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  format: z.enum(["winner_stays", "new_ten", "host_decides"]),
  scoreGoal: z.number().int().min(1).max(100),
  pointSystem: z.enum(["one_two", "two_three"]),
  timeLimitSeconds: z.number().int().min(60).max(3600).optional(),
  sessionCode: z.string().regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;
