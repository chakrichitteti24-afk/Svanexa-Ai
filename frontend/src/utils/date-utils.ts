import { format, parseISO, isValid } from 'date-fns';

/**
 * Validates whether a string is a valid 'YYYY-MM-DD' format.
 */
export function isValidDateString(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = parseISO(dateStr);
  return isValid(parsed);
}

/**
 * Returns a normalized 'YYYY-MM-DD' date string.
 * Uses the passed string if valid, or formats a Date object, or defaults to current date.
 */
export function getNormalizedDate(input?: string | Date | null): string {
  if (typeof input === 'string' && isValidDateString(input)) {
    return input;
  }
  if (input instanceof Date && isValid(input)) {
    return format(input, 'yyyy-MM-dd');
  }
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Extracts a normalized date from a Next.js / Fetch Request.
 * Priority:
 * 1. Query parameter ?date=YYYY-MM-DD
 * 2. Header 'x-client-date'
 * 3. Fallback date or current server date
 */
export function extractDateFromRequest(req: Request, fallbackDate?: string): string {
  try {
    const url = new URL(req.url);
    const queryDate = url.searchParams.get('date');
    if (isValidDateString(queryDate)) {
      return queryDate!;
    }
  } catch {
    // Ignore URL parse errors on relative paths
  }

  const headerDate = req.headers.get('x-client-date');
  if (isValidDateString(headerDate)) {
    return headerDate!;
  }

  return getNormalizedDate(fallbackDate);
}

/**
 * Safely parses any date input (handles ISO, timestamps, space-separated SQL strings) safely on all browsers including iOS Safari.
 */
export function safeParseDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'NaN' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return null;
    }
    const normalized = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
    const parsed = parseISO(normalized);
    if (isValid(parsed)) return parsed;
    const d = new Date(normalized);
    if (isValid(d)) return d;
  }
  return null;
}


/**
 * Safely formats any date or timestamp string without throwing RangeError.
 */
export function safeFormat(
  input: string | number | Date | null | undefined,
  formatStr: string,
  fallback: string = ''
): string {
  const d = safeParseDate(input);
  if (!d) return fallback;
  try {
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}
