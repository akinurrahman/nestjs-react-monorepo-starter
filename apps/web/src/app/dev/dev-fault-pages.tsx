import { PageHeader } from '@/systems/ui';

export function ThrowingPage(): never {
  throw new Error('Thrown on purpose by the /dev/throws route');
}

export function SlowPage() {
  return (
    <PageHeader
      title="Slow page"
      description="Its chunk was held back on purpose, so the progress bar showed while it loaded."
    />
  );
}
