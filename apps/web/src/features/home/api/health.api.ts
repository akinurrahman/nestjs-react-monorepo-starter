import { apiCall } from '@/lib/api/api-call';
import type { Readiness } from '../definitions/health.types';

export const healthApi = {
  getStatus: (signal?: AbortSignal) =>
    apiCall<Readiness>('/health/status', { signal }),
};
