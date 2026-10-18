import { badResponse, ApiError } from '@/lib/api/api-error';
import { CanceledError } from 'axios';
import { isUnexpectedError, reportError } from './report-error';

describe('reportError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs to the console in a production build', () => {
    vi.stubEnv('PROD', true);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const error = new Error('bug');

    reportError(error, { source: 'query' });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(error, { source: 'query' });
  });

  it('does nothing outside a production build', () => {
    vi.stubEnv('PROD', false);
    const consoleError = vi.spyOn(console, 'error');

    reportError(new Error('bug'), { source: 'render' });

    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('isUnexpectedError', () => {
  it.each([
    ['a thrown Error', new Error('bug'), true],
    ['a response that broke the contract', badResponse(200), true],
    ['a proxy page instead of the api', badResponse(502), false],
    [
      'an ApiError the api sent',
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }),
      false,
    ],
    [
      'a 409',
      new ApiError({ status: 409, code: 'CONFLICT', message: 'x' }),
      false,
    ],
    ['a cancellation', new CanceledError(), false],
  ])('%s', (_, error, expected) => {
    expect(isUnexpectedError(error)).toBe(expected);
  });
});
