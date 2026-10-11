const ZONES = ['America/New_York', 'Asia/Kolkata'] as const;

// The file has no static import, so the first test would pay for loading
// date-fns inside its own timeout, which a parallel run can push past.
const COLD_IMPORT_MS = 20_000;

beforeAll(() => import('./date'), COLD_IMPORT_MS);

// Node applies a TZ change at runtime. The formatters are built at module
// load, so each zone also needs a fresh import.
async function inZone(timeZone: string) {
  vi.stubEnv('TZ', timeZone);
  vi.resetModules();
  return import('./date');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('toCalendarDate', () => {
  it('slices the day off a @db.Date instant', async () => {
    const { toCalendarDate } = await inZone('America/New_York');

    expect(toCalendarDate('2026-11-08T00:00:00.000Z')).toBe('2026-11-08');
  });

  it.each([null, undefined, ''])('is empty for %o', async (value) => {
    const { toCalendarDate } = await inZone('UTC');

    expect(toCalendarDate(value)).toBe('');
  });
});

describe('todayCalendarDate', () => {
  it.each([
    ['America/New_York', '2026-10-09'],
    ['Asia/Kolkata', '2026-10-10'],
  ])('answers on the viewer clock in %s', async (zone, expected) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T20:00:00Z'));
    const { todayCalendarDate } = await inZone(zone);

    expect(todayCalendarDate()).toBe(expected);
  });
});

describe('parseCalendarDate', () => {
  it('is local midnight of that day in every zone', async () => {
    for (const zone of ZONES) {
      const { parseCalendarDate, calendarDateOf } = await inZone(zone);
      const date = parseCalendarDate('2026-11-08');

      expect(date?.getHours()).toBe(0);
      expect(date?.getDate()).toBe(8);
      expect(calendarDateOf(date!)).toBe('2026-11-08');
    }
  });

  it.each([
    null,
    undefined,
    '',
    '2026-02-30',
    '2026-13-01',
    '2026-11-08T00:00:00.000Z',
    '8 Nov 2026',
  ])('is undefined for %o', async (value) => {
    const { parseCalendarDate } = await inZone('UTC');

    expect(parseCalendarDate(value)).toBeUndefined();
  });
});

describe('shiftCalendarDate', () => {
  it.each([
    ['2026-10-10', 1, '2026-10-11'],
    ['2026-10-10', -10, '2026-09-30'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    // US daylight saving starts on 2026-03-08 and ends on 2026-11-01.
    ['2026-03-07', 2, '2026-03-09'],
    ['2026-11-01', 1, '2026-11-02'],
  ])('%s by %i is %s', async (date, days, expected) => {
    for (const zone of ZONES) {
      const { shiftCalendarDate } = await inZone(zone);
      expect(shiftCalendarDate(date, days)).toBe(expected);
    }
  });
});

describe('formatDate', () => {
  it.each(['2026-11-08', '2026-11-08T00:00:00.000Z'])(
    'renders %s as the same day in every zone',
    async (value) => {
      for (const zone of ZONES) {
        const { formatDate } = await inZone(zone);
        expect(formatDate(value)).toBe('8 Nov 2026');
      }
    },
  );

  it.each([null, undefined, '', 'not a date', '2026-02-30', '2026-13-01'])(
    'renders %o as a dash',
    async (value) => {
      const { formatDate } = await inZone('UTC');

      expect(formatDate(value)).toBe('-');
    },
  );
});

describe('formatDateTime', () => {
  it.each([
    ['America/New_York', '9 Oct 2026, 4:00 pm'],
    ['Asia/Kolkata', '10 Oct 2026, 1:30 am'],
  ])('renders an instant on the %s clock', async (zone, expected) => {
    const { formatDateTime } = await inZone(zone);

    expect(formatDateTime('2026-10-09T20:00:00Z')).toBe(expected);
  });

  it('accepts a Date and epoch milliseconds', async () => {
    const { formatDateTime } = await inZone('Asia/Kolkata');
    const instant = new Date('2026-10-09T20:00:00Z');

    expect(formatDateTime(instant)).toBe('10 Oct 2026, 1:30 am');
    expect(formatDateTime(instant.getTime())).toBe('10 Oct 2026, 1:30 am');
  });

  it.each([null, undefined, '', 'nope'])(
    'renders %o as a dash',
    async (value) => {
      const { formatDateTime } = await inZone('UTC');

      expect(formatDateTime(value)).toBe('-');
    },
  );
});
