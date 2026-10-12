import { addDays, format, isValid, parseISO } from 'date-fns';
import { APP_LOCALE } from './locale';

const EMPTY = '-';
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A date-only value is a day, not an instant. Rendering it in UTC is what
// stops a viewer west of Greenwich from seeing the day before.
const dateFormat = new Intl.DateTimeFormat(APP_LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormat = new Intl.DateTimeFormat(APP_LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// A @db.Date column arrives as 2026-11-08T00:00:00.000Z. Slicing beats
// parsing: parsing would turn midnight UTC into the previous evening.
export function toCalendarDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

// toISOString().slice(0, 10) would answer in UTC, which is still yesterday
// in India until 05:30.
export function todayCalendarDate(): string {
  return calendarDateOf(new Date());
}

// Date pickers hand back local midnight, so the local day is the value.
export function calendarDateOf(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Local midnight, the shape date pickers work in. Anything but a real
// yyyy-MM-dd day is undefined, so 2026-02-30 never rolls into March.
export function parseCalendarDate(
  value: string | null | undefined,
): Date | undefined {
  if (!value || !CALENDAR_DATE.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function shiftCalendarDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

export function formatDate(value: string | null | undefined): string {
  const match = CALENDAR_DATE.exec(toCalendarDate(value));
  if (!match || !isValid(parseISO(match[0]))) return EMPTY;

  const [, year, month, day] = match.map(Number);
  return dateFormat.format(new Date(Date.UTC(year!, month! - 1, day)));
}

// A month's short name, for a calendar's month picker. The locale defaults
// to the app's, not the browser's, like every other date on screen.
export function formatMonthShort(date: Date, locale: string = APP_LOCALE) {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  const date = new Date(value);
  return isValid(date) ? dateTimeFormat.format(date) : EMPTY;
}
