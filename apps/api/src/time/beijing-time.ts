export const BEIJING_TIME_ZONE = 'Asia/Shanghai';

const BEIJING_UTC_OFFSET_MINUTES = 8 * 60;
const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BEIJING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export type BusinessRange = {
  startUtc: Date;
  endUtc: Date;
};

export function nowUtc(): Date {
  return new Date();
}

export function toBeijingDateString(date: Date): string {
  assertValidDate(date, 'date');

  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  const year = getDatePart(parts, 'year');
  const month = getDatePart(parts, 'month');
  const day = getDatePart(parts, 'day');

  return `${year}-${month}-${day}`;
}

export function getBeijingDayRange(date: Date): BusinessRange {
  const beijingDateString = toBeijingDateString(date);
  const { year, month, day } = parseBeijingDateString(beijingDateString);
  const startUtc = fromBeijingDateTimeToUtc(year, month, day);
  const endUtc = fromBeijingDateTimeToUtc(year, month, day + 1);

  return { startUtc, endUtc };
}

export function getBeijingDateRange(startDate: string, endDate: string): BusinessRange {
  const start = parseBeijingDateString(startDate);
  const end = parseBeijingDateString(endDate);
  assertRealBeijingDate(startDate, start);
  assertRealBeijingDate(endDate, end);

  const startUtc = fromBeijingDateTimeToUtc(start.year, start.month, start.day);
  const endUtc = fromBeijingDateTimeToUtc(end.year, end.month, end.day + 1);
  assertValidBusinessRange(startUtc, endUtc);

  return { startUtc, endUtc };
}

export function getCurrentBeijingYearMonth(date: Date = new Date()): { year: number; month: number } {
  const { year, month } = parseBeijingDateString(toBeijingDateString(date));
  return { year, month };
}

export function getBeijingMonthRange(year: number, month: number): BusinessRange {
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError('year must be a positive integer.');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('month must be an integer from 1 through 12.');
  }

  return {
    startUtc: fromBeijingDateTimeToUtc(year, month, 1),
    endUtc: fromBeijingDateTimeToUtc(year, month + 1, 1)
  };
}

export function assertValidBusinessRange(startUtc: Date, endUtc: Date): void {
  assertValidDate(startUtc, 'startUtc');
  assertValidDate(endUtc, 'endUtc');

  if (startUtc.getTime() >= endUtc.getTime()) {
    throw new RangeError('startUtc must be before endUtc.');
  }
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type);

  if (!part) {
    throw new Error(`Could not format Beijing date part: ${type}`);
  }

  return part.value;
}

function fromBeijingDateTimeToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, -BEIJING_UTC_OFFSET_MINUTES, 0, 0));
}

function parseBeijingDateString(dateString: string): { year: number; month: number; day: number } {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(dateString);

  if (!match?.groups) {
    throw new TypeError(`Invalid Beijing date string: ${dateString}`);
  }

  return {
    year: Number(match.groups.year),
    month: Number(match.groups.month),
    day: Number(match.groups.day)
  };
}

function assertRealBeijingDate(
  dateString: string,
  parts: { year: number; month: number; day: number }
): void {
  const normalized = toBeijingDateString(
    fromBeijingDateTimeToUtc(parts.year, parts.month, parts.day)
  );

  if (normalized !== dateString) {
    throw new TypeError(`Invalid Beijing date string: ${dateString}`);
  }
}

function assertValidDate(date: Date, name: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${name} must be a valid Date.`);
  }
}
