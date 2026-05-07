import {
  assertValidBusinessRange,
  BEIJING_TIME_ZONE,
  getBeijingDateRange,
  getBeijingDayRange,
  getBeijingMonthRange,
  toBeijingDateString
} from './beijing-time';

describe('beijing-time utilities', () => {
  it('exports the Asia/Shanghai business timezone', () => {
    expect(BEIJING_TIME_ZONE).toBe('Asia/Shanghai');
  });

  it('maps UTC instants to Beijing natural dates', () => {
    expect(toBeijingDateString(new Date('2026-05-05T16:00:00.000Z'))).toBe('2026-05-06');
  });

  it('returns exact UTC boundaries for a Beijing natural day', () => {
    const range = getBeijingDayRange(new Date('2026-05-06T08:00:00.000Z'));

    expect(range.startUtc.toISOString()).toBe('2026-05-05T16:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-05-06T16:00:00.000Z');
  });

  it('returns exact UTC boundaries for a Beijing natural month', () => {
    const range = getBeijingMonthRange(2026, 5);

    expect(range.startUtc.toISOString()).toBe('2026-04-30T16:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-05-31T16:00:00.000Z');
  });

  it('returns inclusive UTC boundaries for Beijing detail query date ranges', () => {
    const range = getBeijingDateRange('2026-05-01', '2026-05-31');

    expect(range.startUtc.toISOString()).toBe('2026-04-30T16:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-05-31T16:00:00.000Z');
  });

  it('rejects malformed Beijing detail query date strings', () => {
    expect(() => getBeijingDateRange('2026/05/01', '2026-05-31')).toThrow(TypeError);
  });

  it('rejects Beijing detail query date ranges where start is after end', () => {
    expect(() => getBeijingDateRange('2026-05-31', '2026-05-01')).toThrow(RangeError);
  });

  it('rejects invalid business ranges', () => {
    expect(() =>
      assertValidBusinessRange(new Date('2026-05-06T16:00:00.000Z'), new Date('2026-05-05T16:00:00.000Z'))
    ).toThrow(RangeError);
  });
});
