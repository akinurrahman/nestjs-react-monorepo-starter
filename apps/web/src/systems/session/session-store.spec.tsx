import { act, renderHook } from '@testing-library/react';
import { setStubRole, useSession, useSessionStore } from './session-store';

describe('session stub', () => {
  beforeEach(() => {
    useSessionStore.setState(useSessionStore.getInitialState(), true);
  });

  it('starts with an ADMIN stub user in dev', () => {
    const { result } = renderHook(() => useSession());

    expect(result.current.user?.role).toBe('ADMIN');
  });

  it('changes the stub role', () => {
    const { result } = renderHook(() => useSession());

    act(() => setStubRole('USER'));

    expect(result.current.user?.role).toBe('USER');
  });

  it('does not create a user when there is none', () => {
    useSessionStore.setState({ user: null });
    const { result } = renderHook(() => useSession());

    act(() => setStubRole('ADMIN'));

    expect(result.current.user).toBeNull();
  });
});
