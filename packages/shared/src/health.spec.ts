import { healthSchema, readinessSchema } from './health.js';

describe('healthSchema', () => {
  it('accepts an ok status', () => {
    expect(healthSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it.each([{}, { status: 'down' }])('rejects %j', (value) => {
    expect(healthSchema.safeParse(value).success).toBe(false);
  });
});

describe('readinessSchema', () => {
  it('accepts an ok status with an ok database check', () => {
    const body = { status: 'ok', checks: { database: 'ok' } };

    expect(readinessSchema.parse(body)).toEqual(body);
  });

  it.each([
    { status: 'ok' },
    { status: 'ok', checks: {} },
    { status: 'ok', checks: { database: 'down' } },
  ])('rejects %j', (value) => {
    expect(readinessSchema.safeParse(value).success).toBe(false);
  });
});
