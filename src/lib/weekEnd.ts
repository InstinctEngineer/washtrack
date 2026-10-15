import { addDays, format } from 'date-fns';

/** Locked: Monday start + 6 days. Unlocked: custom end, if it is on/after start; otherwise the full week. */
export function resolveWeekEnd(start: string, locked: boolean, customEnd: string | null): string {
  const fullWeek = format(addDays(new Date(`${start}T00:00:00`), 6), 'yyyy-MM-dd');
  if (locked || !customEnd || customEnd < start) return fullWeek;
  return customEnd;
}
