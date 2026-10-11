import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PreviewSection, Specimen } from './preview-layout';
import { useFailingMutation } from './use-failing-mutation';

const PROMISE_MS = 1500;

const LONG_MESSAGE =
  'The export finished, but 3 of the 1,284 rows were skipped because their start date falls outside the payroll period. Download the skipped rows from the export history to fix them and run the export again.';

export function ToastsSection() {
  const failing = useFailingMutation();

  return (
    <PreviewSection
      id="toasts"
      description="Every toast type, an action, a long message, and the toast the global MutationCache shows for a failed write."
    >
      <Specimen label="Types">
        <Button variant="outline" onClick={() => toast('Draft saved')}>
          Default
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.success('Employee created')}
        >
          Success
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error('Could not save the employee')}
        >
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.info('A new version is rolling out')}
        >
          Info
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.warning('Your session expires in 5 minutes')}
        >
          Warning
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.loading('Uploading 3 files')}
        >
          Loading
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void toast.promise(
              new Promise((resolve) => setTimeout(resolve, PROMISE_MS)),
              {
                loading: 'Generating report',
                success: 'Report ready',
                error: 'Report failed',
              },
            )
          }
        >
          Promise
        </Button>
        <Button variant="outline" onClick={() => toast.dismiss()}>
          Dismiss all
        </Button>
      </Specimen>

      <Specimen label="Content">
        <Button
          variant="outline"
          onClick={() =>
            toast.success('Invoice sent', {
              description: 'Acme Ltd will get it at billing@acme.example.',
            })
          }
        >
          With description
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast('Employee archived', {
              action: {
                label: 'Undo',
                onClick: () => toast.success('Archive undone'),
              },
            })
          }
        >
          With action
        </Button>
        <Button variant="outline" onClick={() => toast.warning(LONG_MESSAGE)}>
          Long message
        </Button>
        <Button
          variant="outline"
          disabled={failing.isPending}
          onClick={() => failing.mutate()}
        >
          Mutation error
        </Button>
      </Specimen>
    </PreviewSection>
  );
}
