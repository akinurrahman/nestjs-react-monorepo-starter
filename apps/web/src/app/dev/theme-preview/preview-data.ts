import type { PaginatedResponse } from '@starter/shared';
import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  FileText,
  Plane,
} from 'lucide-react';
import { createLookup } from '@/lib/lookup/create-lookup';
import { defineUrlFilters, pagingSpec } from '@/systems/filters';
import {
  fromPaginated,
  type AsyncOptionsSource,
  type Option,
} from '@/systems/form';
import { paginateFixture } from '@/test/paginate';

// One status per badge variant, so the table and the badge section show them
// all.
export const previewStatusLookup = createLookup(
  {
    active: { label: 'Active', badgeVariant: 'success', icon: CircleCheck },
    probation: { label: 'Probation', badgeVariant: 'info', icon: Clock },
    leave: { label: 'On leave', badgeVariant: 'warning', icon: Plane },
    terminated: {
      label: 'Terminated',
      badgeVariant: 'destructive',
      icon: CircleSlash,
    },
    contractor: { label: 'Contractor', badgeVariant: 'outline' },
    draft: { label: 'Draft', badgeVariant: 'secondary', icon: FileText },
    invited: { label: 'Invited', badgeVariant: 'default', icon: CircleDashed },
  },
  'PreviewStatus',
);

export type PreviewStatus = (typeof previewStatusLookup.values)[number];

export const DEPARTMENTS: Option[] = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'finance', label: 'Finance' },
  { value: 'people', label: 'People' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Support' },
];

export const REGIONS: Option[] = [
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'americas', label: 'Americas' },
];

type Country = Option & { region: string; cities: readonly string[] };

const COUNTRIES: Country[] = [
  {
    value: 'de',
    label: 'Germany',
    region: 'europe',
    cities: ['Berlin', 'Munich'],
  },
  { value: 'fr', label: 'France', region: 'europe', cities: ['Paris', 'Lyon'] },
  { value: 'es', label: 'Spain', region: 'europe', cities: ['Madrid'] },
  {
    value: 'in',
    label: 'India',
    region: 'asia',
    cities: ['Bengaluru', 'Pune'],
  },
  { value: 'jp', label: 'Japan', region: 'asia', cities: ['Tokyo', 'Osaka'] },
  { value: 'sg', label: 'Singapore', region: 'asia', cities: ['Singapore'] },
  {
    value: 'us',
    label: 'United States',
    region: 'americas',
    cities: ['Austin', 'Seattle'],
  },
  { value: 'br', label: 'Brazil', region: 'americas', cities: ['Sao Paulo'] },
  { value: 'ca', label: 'Canada', region: 'americas', cities: ['Toronto'] },
];

const FIRST_NAMES = [
  'Ada',
  'Grace',
  'Alan',
  'Linus',
  'Margaret',
  'Dennis',
  'Barbara',
  'Ken',
  'Frances',
  'Edsger',
  'Radia',
  'Tim',
  'Hedy',
  'John',
  'Katherine',
  'Donald',
  'Annie',
  'Niklaus',
  'Joan',
  'Bjarne',
  'Sophie',
  'Guido',
  'Mary',
  'Yukihiro',
];

const LAST_NAMES = [
  'Lovelace',
  'Hopper',
  'Turing',
  'Torvalds',
  'Hamilton',
  'Ritchie',
  'Liskov',
  'Thompson',
  'Allen',
  'Dijkstra',
  'Perlman',
  'Berners-Lee',
  'Lamarr',
  'McCarthy',
  'Johnson',
  'Knuth',
  'Easley',
  'Wirth',
  'Clarke',
  'Stroustrup',
  'Wilson',
  'van Rossum',
  'Keller',
  'Matsumoto',
];

export type PreviewPerson = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  status: PreviewStatus;
  region: string;
  country: string;
  city: string;
  startDate: string;
  // Minor units, as the api sends money.
  salary: number;
  managerId: string;
};

export const COUNTRY_OPTIONS: Option[] = COUNTRIES.map(({ value, label }) => ({
  value,
  label,
}));

const PEOPLE_COUNT = 137;

// Index arithmetic instead of Math.random, so every load and every test sees
// the same rows.
export const PEOPLE: PreviewPerson[] = Array.from(
  { length: PEOPLE_COUNT },
  (_, index) => {
    const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
    const last = LAST_NAMES[(index * 7) % LAST_NAMES.length]!;
    const country = COUNTRIES[(index * 5) % COUNTRIES.length]!;
    const number = String(index + 1).padStart(4, '0');
    const month = String((index % 12) + 1).padStart(2, '0');
    const day = String((index % 28) + 1).padStart(2, '0');

    return {
      id: `p-${number}`,
      code: `EMP-${number}`,
      name: `${first} ${last}`,
      email:
        `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') +
        '@example.com',
      phone: `+1 555 01${String(index % 100).padStart(2, '0')}`,
      department: DEPARTMENTS[(index * 3) % DEPARTMENTS.length]!.value,
      status:
        previewStatusLookup.values[index % previewStatusLookup.values.length]!,
      region: country.region,
      country: country.value,
      city: country.cities[index % country.cities.length]!,
      startDate: `${2016 + (index % 10)}-${month}-${day}`,
      salary: 4_200_000 + ((index * 7919) % 9_000_000),
      // The first twelve people manage everyone, themselves included.
      managerId: `p-${String((index % 12) + 1).padStart(4, '0')}`,
    };
  },
);

const PEOPLE_BY_ID = new Map(PEOPLE.map((person) => [person.id, person]));

export function personName(id: string): string {
  return PEOPLE_BY_ID.get(id)?.name ?? id;
}

export function departmentLabel(value: string): string {
  return DEPARTMENTS.find((option) => option.value === value)?.label ?? value;
}

export function countryLabel(value: string): string {
  return COUNTRIES.find((option) => option.value === value)?.label ?? value;
}

const SOURCE_DELAY_MS = 450;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

const matches = (label: string, search: string) =>
  label.toLowerCase().includes(search.trim().toLowerCase());

// Shaped like a feature's options source, served from memory with a delay so
// the loading row and paging on scroll are visible.
export const peopleSource: AsyncOptionsSource = {
  queryKey: ['dev', 'people', 'options'],
  fetch: async ({ search, page, limit, parentValues, signal }) => {
    await wait(SOURCE_DELAY_MS, signal);
    const department = parentValues.department as string | undefined;
    const found = PEOPLE.filter(
      (person) =>
        matches(person.name, search) &&
        (!department || person.department === department),
    );
    return fromPaginated(paginateFixture(found, page, limit), (person) => ({
      value: person.id,
      label: person.name,
    }));
  },
};

export const countrySource: AsyncOptionsSource = {
  queryKey: ['dev', 'countries', 'options'],
  fetch: async ({ search, page, limit, parentValues, signal }) => {
    await wait(SOURCE_DELAY_MS, signal);
    const region = parentValues.region as string | undefined;
    const found = COUNTRIES.filter(
      (country) =>
        matches(country.label, search) &&
        (!region || country.region === region),
    );
    return fromPaginated(paginateFixture(found, page, limit), (country) => ({
      value: country.value,
      label: country.label,
    }));
  },
};

export type PreviewFilters = {
  search?: string;
  status?: PreviewStatus;
  manager?: string;
  departments?: string[];
  region?: string;
  country?: string;
  page: number;
  limit: number;
};

export const PREVIEW_FILTER_SPEC = defineUrlFilters<PreviewFilters>({
  search: {},
  status: { values: previewStatusLookup.values },
  manager: {},
  departments: {
    kind: 'list',
    param: 'department',
    values: DEPARTMENTS.map((option) => option.value),
  },
  region: { values: REGIONS.map((option) => option.value) },
  country: {},
  ...pagingSpec(20),
});

export function filterPeople(filters: PreviewFilters): PreviewPerson[] {
  return PEOPLE.filter(
    (person) =>
      (!filters.search ||
        matches(
          `${person.name} ${person.email} ${person.code}`,
          filters.search,
        )) &&
      (!filters.status || person.status === filters.status) &&
      (!filters.manager || person.managerId === filters.manager) &&
      (!filters.departments?.length ||
        filters.departments.includes(person.department)) &&
      (!filters.region || person.region === filters.region) &&
      (!filters.country || person.country === filters.country),
  );
}

export function pagePeople(
  people: readonly PreviewPerson[],
  page: number,
  limit: number,
): PaginatedResponse<PreviewPerson> {
  return paginateFixture(people, page, limit);
}
