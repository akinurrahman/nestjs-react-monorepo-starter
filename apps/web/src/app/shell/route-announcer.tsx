import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useHandleMatches } from '@/systems/router';
import { APP_NAME } from '../config';

// After a navigation to another page, focus goes to main and the page title
// is read out, which a single-page app otherwise never signals. Not on first
// load, where the browser announces the document itself, and not when only
// the search changes: filters write the URL while someone types in them.
export function RouteAnnouncer({ mainId }: { mainId: string }) {
  const { pathname } = useLocation();
  const matches = useHandleMatches();
  const title = matches.findLast((match) => match.handle?.title)?.handle?.title;
  const [announcement, setAnnouncement] = useState('');
  const announcedPath = useRef(pathname);

  useEffect(() => {
    if (announcedPath.current === pathname) return;
    announcedPath.current = pathname;
    // Scrolling is ScrollRestoration's job.
    document.getElementById(mainId)?.focus({ preventScroll: true });
    setAnnouncement(title ?? APP_NAME);
  }, [pathname, title, mainId]);

  return (
    // An explicit status role: screen readers treat <output> as a live
    // region less reliably.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <p role="status" className="sr-only">
      {announcement}
    </p>
  );
}
