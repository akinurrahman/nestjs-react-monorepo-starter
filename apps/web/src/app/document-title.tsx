import { useEffect } from 'react';
import { useHandleMatches } from '@/systems/router';
import { formatDocumentTitle } from './config';

export function DocumentTitle() {
  const matches = useHandleMatches();
  const title = matches.findLast((match) => match.handle?.title)?.handle?.title;

  useEffect(() => {
    document.title = formatDocumentTitle(title);
  }, [title]);

  return null;
}
