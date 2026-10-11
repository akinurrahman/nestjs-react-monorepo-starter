import { ERROR_CODES } from '@starter/shared';
import { Inbox, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, CLIENT_ERROR_CODES } from '@/lib/api/api-error';
import {
  AccessDeniedState,
  EmptyState,
  ErrorState,
  NotFoundState,
  PageHeader,
  PanelSection,
} from '@/systems/ui';
import { PreviewSection } from './preview-layout';

const CONFLICT = new ApiError({
  status: 409,
  code: ERROR_CODES.CONFLICT,
  message: 'This record was changed by someone else',
});

const NETWORK_DOWN = new ApiError({
  status: 0,
  code: CLIENT_ERROR_CODES.NETWORK_ERROR,
  message: 'Network error',
});

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="grid gap-2">
      <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </figcaption>
      <div className="rounded-xl border border-dashed border-border p-4">
        {children}
      </div>
    </figure>
  );
}

const retry = () => toast('Retry clicked');

export function StatesSection() {
  return (
    <PreviewSection
      id="states"
      description="The page chrome and the loading, empty, error and access states from systems/ui."
    >
      <Frame label="PageHeader">
        <PageHeader
          title="Example page"
          description="PageHeader with a description and actions. This one renders a second h1, which a real page never does."
          actions={
            <>
              <Button variant="outline">Export</Button>
              <Button>
                <Plus />
                New
              </Button>
            </>
          }
          className="pb-0"
        />
      </Frame>

      <div className="grid gap-4 lg:grid-cols-2">
        <Frame label="EmptyState">
          <EmptyState
            icon={Inbox}
            title="No invoices yet"
            description="Invoices you create show up here."
            action={
              <Button variant="outline" size="lg">
                <Plus />
                New invoice
              </Button>
            }
          />
        </Frame>
        <Frame label="ErrorState, 4xx with retry">
          <ErrorState error={CONFLICT} onRetry={retry} />
        </Frame>
        <Frame label="ErrorState, network error">
          <ErrorState error={NETWORK_DOWN} onRetry={retry} />
        </Frame>
        <Frame label="ErrorState, unknown error, no retry">
          <ErrorState title="This page could not be shown" />
        </Frame>
        <Frame label="NotFoundState">
          <NotFoundState
            action={
              <Button variant="outline" size="lg">
                Back to the list
              </Button>
            }
          />
        </Frame>
        <Frame label="AccessDeniedState">
          <AccessDeniedState />
        </Frame>
      </div>

      <Frame label="PanelSection">
        <PanelSection
          title="Billing details"
          description="PanelSection with a description and an action."
          action={
            <Button variant="outline" size="sm">
              Edit
            </Button>
          }
        >
          <p className="text-sm">Card ending 4242, expires 08/29.</p>
          <p className="text-sm text-muted-foreground">
            Invoices go to billing@example.com.
          </p>
        </PanelSection>
      </Frame>

      <Frame label="Skeletons">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </Frame>
    </PreviewSection>
  );
}
