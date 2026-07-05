/**
 * Helpers for the two Discord REST error codes that are safe to swallow when
 * responding to an interaction: the interaction has already expired, or it was
 * already acknowledged by another handler. Previously duplicated across the
 * slash / button / modal interaction handlers.
 */

/** Interaction token expired / unknown — nothing can be sent in response. */
export const UNKNOWN_INTERACTION = 10062;
/** Interaction already acknowledged — a second reply would fail. */
export const ALREADY_ACKNOWLEDGED = 40060;

export function getDiscordApiErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;

  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

/** True when the error is a benign "can't respond to this interaction" code. */
export function isIgnorableInteractionError(error: unknown): boolean {
  const code = getDiscordApiErrorCode(error);
  return code === UNKNOWN_INTERACTION || code === ALREADY_ACKNOWLEDGED;
}
