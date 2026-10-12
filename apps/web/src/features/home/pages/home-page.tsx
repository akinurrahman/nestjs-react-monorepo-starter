import { ERROR_CODES } from '@starter/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/api-error';
import { LookupBadge, PageHeader, PanelSection } from '@/systems/ui';
import { useApiHealth } from '../api/health.queries';
import {
  healthStatusLookup,
  type HealthStatus,
} from '../definitions/health.lookup';

// The error, not the data: a failed refetch keeps the last good data, and
// the badge has to show the current state.
function toHealthStatus(error: Error | null): HealthStatus {
  if (!error) return healthStatusLookup.keys.up;
  if (isApiError(error) && error.code === ERROR_CODES.SERVICE_UNAVAILABLE) {
    return healthStatusLookup.keys.databaseDown;
  }
  return healthStatusLookup.keys.unreachable;
}

export default function HomePage() {
  const { error, isLoading } = useApiHealth();

  return (
    <>
      <PageHeader title="Home" />
      <PanelSection
        title="API status"
        description="Whether the API and its database are answering."
      >
        {isLoading ? (
          <output aria-label="Checking API status" className="block">
            <Skeleton className="h-5 w-36" />
          </output>
        ) : (
          <LookupBadge
            lookup={healthStatusLookup}
            value={toHealthStatus(error)}
          />
        )}
      </PanelSection>
    </>
  );
}
