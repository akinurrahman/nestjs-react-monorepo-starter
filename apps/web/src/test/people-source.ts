import { delay, http, HttpResponse } from 'msw';
import { apiCallPaginated } from '@/lib/api/api-call';
import { fromPaginated } from '@/systems/form/lib/from-paginated';
import type { AsyncOptionsSource } from '@/systems/form/types';
import { server } from './msw-server';
import { paginateFixture } from './paginate';

type Person = { id: string; name: string; team: string };

const NAMED: Person[] = [
  { id: 'alice', name: 'Alice', team: 'red' },
  { id: 'bob', name: 'Bob', team: 'red' },
  { id: 'carol', name: 'Carol', team: 'blue' },
];

// Enough red filler for a second page of the unfiltered red list.
const FILLER: Person[] = Array.from({ length: 30 }, (_, index) => ({
  id: `red-${index + 1}`,
  name: `Red member ${index + 1}`,
  team: 'red',
}));

const PEOPLE = [...NAMED, ...FILLER];

export const peopleSource: AsyncOptionsSource = {
  queryKey: ['people', 'options'],
  fetch: async ({ search, page, limit, parentValues, signal }) =>
    fromPaginated(
      await apiCallPaginated<Person>('/people', {
        params: {
          search: search || undefined,
          page,
          limit,
          team: parentValues.team as string | undefined,
        },
        signal,
      }),
      (person) => ({ value: person.id, label: person.name }),
    ),
};

type ServeOptions = {
  // Responds to the n-th request (1-based) with a 500.
  failOn?: number[];
  // Holds every request after the first by this many ms.
  laterDelayMs?: number;
};

export function servePeople({ failOn = [], laterDelayMs }: ServeOptions = {}) {
  const requests: URLSearchParams[] = [];

  server.use(
    http.get('/api/people', async ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      if (laterDelayMs && requests.length > 1) await delay(laterDelayMs);

      if (failOn.includes(requests.length)) {
        return HttpResponse.json(
          { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Boom' },
          { status: 500 },
        );
      }

      const search = params.get('search')?.toLowerCase() ?? '';
      const team = params.get('team');
      const page = Number(params.get('page'));
      const limit = Number(params.get('limit'));
      const matches = PEOPLE.filter(
        (person) =>
          person.name.toLowerCase().includes(search) &&
          (!team || person.team === team),
      );

      return HttpResponse.json(paginateFixture(matches, page, limit));
    }),
  );

  return requests;
}
