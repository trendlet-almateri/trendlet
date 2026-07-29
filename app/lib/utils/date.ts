import { formatDistanceToNowStrict, format } from "date-fns";

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function shortDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "MMM d");
}

/** Compact date + time, e.g. "Jun 25 · 14:30" — for dense rows/summaries. */
export function shortDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "MMM d · HH:mm");
}

export function fullDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "MMM d, yyyy · HH:mm");
}
