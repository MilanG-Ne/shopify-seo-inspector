import type { LengthRange } from "./text";

export type LengthTone = "success" | "warning" | "critical";

/**
 * Colour for a live character counter: green inside the range, amber when
 * there's text but not enough, red when empty or long enough to be cut off.
 */
export function lengthTone(
  length: number,
  range: LengthRange,
  emptyTone: LengthTone = "critical",
): LengthTone {
  if (length === 0) return emptyTone;
  if (length > range.max) return "critical";
  if (length < range.min) return "warning";
  return "success";
}

export function lengthHint(length: number, range: LengthRange): string {
  if (length === 0) return "Empty";
  if (length < range.min) return `${range.min - length} under the ${range.min}-character minimum`;
  if (length > range.max) return `${length - range.max} over; search results will cut this off`;
  return "Good length";
}
