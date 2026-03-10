import { z } from "zod";
import type { AnyBackboneEvent, BackboneEventType } from "@tambola/types";

const eventTypeSchema = z.enum([
  "ROOM_CREATED",
  "PLAYER_JOINED",
  "GAME_STARTED",
  "NUMBER_CALLED",
  "CLAIM_ACCEPTED",
  "GAME_ENDED"
]);

export const backboneEventSchema = z.object({
  eventId: z.string().min(1),
  roomId: z.string().uuid(),
  offset: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  type: eventTypeSchema,
  payload: z.record(z.string(), z.unknown())
});

export type BackboneEventEnvelope = z.infer<typeof backboneEventSchema>;

export function assertBackboneEvent<TType extends BackboneEventType>(event: AnyBackboneEvent): AnyBackboneEvent {
  backboneEventSchema.parse(event);
  return event as AnyBackboneEvent & { type: TType };
}
