import { z } from "zod";

export const joinRunSchema = z.object({
  displayName: z.string().min(1).max(50).transform((s) => s.trim()),
});

export type JoinRunInput = z.infer<typeof joinRunSchema>;

// PATCH schema for a queue entry — status changes only (reinstate / mark out /
// remove). Benching is handled entirely in the team-assignment draft state and
// never hits this endpoint.
export const queueEntryPatchSchema = z.object({
  status: z.enum(["waiting", "marked_out", "removed"]),
});

export type QueueEntryPatchInput = z.infer<typeof queueEntryPatchSchema>;
