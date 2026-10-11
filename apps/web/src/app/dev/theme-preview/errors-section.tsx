import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { SLOW_ROUTE_DELAY_MS } from '../dev-routes';
import { PreviewSection } from './preview-layout';

const LINKS = [
  {
    to: '/dev/throws',
    label: 'Page that throws',
    expect:
      'The layout error boundary replaces the page and the shell stays usable.',
  },
  {
    to: '/dev/chunk-error',
    label: 'Page whose chunk fails',
    expect: '"A new version is available" with a Reload button.',
  },
  {
    to: '/dev/slow',
    label: 'Slow page',
    expect: `The progress bar runs for ${SLOW_ROUTE_DELAY_MS / 1000} seconds, then the page shows.`,
  },
  {
    to: '/dev/no-such-page',
    label: 'Unknown URL',
    expect: 'The 404 inside the layout.',
  },
];

export function ErrorsSection() {
  return (
    <PreviewSection
      id="errors"
      description="Each link leaves this page. Use Back to return."
    >
      <ul className="grid gap-3">
        {LINKS.map((link) => (
          <li
            key={link.to}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
          >
            <Button
              variant="outline"
              className="justify-start sm:w-56"
              nativeButton={false}
              render={<Link to={link.to} />}
            >
              {link.label}
            </Button>
            <p className="text-sm text-muted-foreground">{link.expect}</p>
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
