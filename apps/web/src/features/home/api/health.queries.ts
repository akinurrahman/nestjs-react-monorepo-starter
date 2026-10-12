import { useQuery } from '@tanstack/react-query';
import { HEALTH_KEYS } from '../definitions/health.constants';
import { healthApi } from './health.api';

export function useApiHealth() {
  return useQuery({
    queryKey: HEALTH_KEYS.status(),
    queryFn: ({ signal }) => healthApi.getStatus(signal),
    // A failure is the answer this query exists to show. Retrying would
    // hold the skeleton through the backoff, and each readiness attempt can
    // already take the API's 2s database ping timeout.
    retry: false,
    // The page shows the failure as a status, so a failed refetch needs no
    // toast on top.
    meta: { handledError: true },
  });
}
