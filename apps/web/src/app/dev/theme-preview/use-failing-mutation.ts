import { ERROR_CODES } from '@starter/shared';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/api-error';

const FAIL_AFTER_MS = 1200;

// A real mutation that rejects, so the global MutationCache error toast fires
// exactly as it does for a feature's write.
export function useFailingMutation() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, FAIL_AFTER_MS));
      throw new ApiError({
        status: 409,
        code: ERROR_CODES.CONFLICT,
        message: 'Someone else changed this record. Reload and try again.',
      });
    },
  });
}
