import { ValidationError } from "@/lib/errors";

/** Attendance dates are stored as UTC midnight of the IST calendar day. */
export function utcDay(key: string) {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new ValidationError(`Invalid date ${key}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
