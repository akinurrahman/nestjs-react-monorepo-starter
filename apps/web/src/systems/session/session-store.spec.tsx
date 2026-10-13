import { act, renderHook } from '@testing-library/react';
import { testUser } from '@/test/auth-fixtures';
import { endSession, setSessionUser, useSession } from './session-store';

describe('session store', () => {
  it('starts checking, with no user', () => {
    const { result } = renderHook(() => useSession());

    expect(result.current).toEqual({
      status: 'checking',
      user: null,
      endedBy: null,
    });
  });

  it('holds the signed-in user', () => {
    const { result } = renderHook(() => useSession());

    act(() => setSessionUser(testUser('USER')));

    expect(result.current.status).toBe('ready');
    expect(result.current.user?.role).toBe('USER');
  });

  it.each(['logout', 'expired', null] as const)(
    'ends the session with endedBy %s',
    (endedBy) => {
      const { result } = renderHook(() => useSession());
      act(() => setSessionUser(testUser()));

      act(() => endSession(endedBy));

      expect(result.current).toEqual({ status: 'ready', user: null, endedBy });
    },
  );

  it('clears endedBy on the next sign in', () => {
    const { result } = renderHook(() => useSession());
    act(() => endSession('expired'));

    act(() => setSessionUser(testUser()));

    expect(result.current.endedBy).toBeNull();
  });
});
