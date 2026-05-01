// Compute the user-local calendar date string (YYYY-MM-DD) for an IANA tz.
// Falls back to UTC for invalid tz values rather than throwing — protects the
// API from accidental bad input on a user's stored timezone.
export function todayInTz(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

// Add `days` to a YYYY-MM-DD string (negative values subtract).
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
