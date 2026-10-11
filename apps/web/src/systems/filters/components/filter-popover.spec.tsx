import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { peopleSource, servePeople } from '@/test/people-source';
import { renderWithRouter } from '@/test/render-with-router';
import { defineUrlFilters, pagingSpec } from '../hooks/use-url-filters';
import { dependentsOf, type FilterPopoverField } from '../lib/popover-fields';
import { FilterPopover } from './filter-popover';

type Filters = {
  search?: string;
  status?: 'open' | 'closed';
  region?: string;
  country?: string;
  city?: string;
  tags?: string[];
  remote?: 'true';
  owner?: string;
  since?: string;
  page: number;
  limit: number;
};

const SPEC = defineUrlFilters<Filters>({
  search: {},
  status: { values: ['open', 'closed'], defaultValue: 'open' },
  region: {},
  country: {},
  city: {},
  tags: { kind: 'list', param: 'tag', values: ['a', 'b'] },
  remote: { values: ['true'] },
  owner: {},
  since: {},
  ...pagingSpec(20),
});

const CHAIN: FilterPopoverField<Filters>[] = [
  {
    key: 'region',
    label: 'Region',
    type: 'select',
    options: [
      { value: 'eu', label: 'Europe' },
      { value: 'na', label: 'North America' },
    ],
  },
  {
    key: 'country',
    label: 'Country',
    type: 'select',
    dependsOn: 'region',
    options: [
      { value: 'de', label: 'Germany' },
      { value: 'us', label: 'United States' },
    ],
  },
  {
    key: 'city',
    label: 'City',
    type: 'select',
    dependsOn: 'country',
    options: [
      { value: 'berlin', label: 'Berlin' },
      { value: 'nyc', label: 'New York' },
    ],
  },
];

const FIELDS: FilterPopoverField<Filters>[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'radio',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  ...CHAIN,
  {
    key: 'tags',
    label: 'Tags',
    type: 'multiSelect',
    options: [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ],
  },
  { key: 'remote', label: 'Remote only', type: 'switch' },
  { key: 'owner', label: 'Owner', type: 'asyncSelect', source: peopleSource },
  { key: 'since', label: 'Since', type: 'date' },
];

function renderPopover(url = '/') {
  return {
    ...renderWithRouter(<FilterPopover spec={SPEC} fields={FIELDS} />, {
      url,
      withQuery: true,
    }),
    user: userEvent.setup(),
  };
}

const trigger = () => screen.getByRole('button', { name: /^Filters/ });
const dialog = () => screen.getByRole('dialog', { name: 'Filters' });

async function openPopover(user: UserEvent) {
  await user.click(trigger());
  return screen.findByRole('dialog', { name: 'Filters' });
}

async function pick(user: UserEvent, control: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: control }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('FilterPopover', () => {
  it('names every control', async () => {
    const { user } = renderPopover('/?region=eu&country=de');
    const popup = within(await openPopover(user));

    expect(popup.getByRole('radiogroup', { name: 'Status' })).toBeVisible();
    expect(popup.getByRole('combobox', { name: 'Region' })).toBeVisible();
    expect(popup.getByRole('combobox', { name: 'Country' })).toBeVisible();
    expect(popup.getByRole('combobox', { name: 'City' })).toBeVisible();
    expect(popup.getByRole('combobox', { name: 'Tags' })).toBeVisible();
    expect(popup.getByRole('switch', { name: 'Remote only' })).toBeVisible();
    expect(popup.getByRole('combobox', { name: 'Owner' })).toBeVisible();
    expect(popup.getByRole('button', { name: 'Since' })).toBeVisible();
  });

  it('seeds the draft from the URL on open', async () => {
    const { user } = renderPopover('/?status=closed&tag=b&remote=true');
    const popup = within(await openPopover(user));

    expect(popup.getByRole('radio', { name: 'Closed' })).toBeChecked();
    expect(popup.getByText('Beta')).toBeVisible();
    expect(popup.getByRole('switch', { name: 'Remote only' })).toBeChecked();
  });

  it('does not touch the URL until Apply', async () => {
    const { user, searchParams, navigations } = renderPopover('/?page=3');
    await openPopover(user);

    await user.click(screen.getByRole('radio', { name: 'Closed' }));
    await user.click(screen.getByRole('switch', { name: 'Remote only' }));
    await pick(user, 'Region', 'Europe');

    expect(navigations()).toBe(0);
    expect(searchParams().toString()).toBe('page=3');
  });

  it('applies every change in one URL update and starts on page 1', async () => {
    const { user, searchParams, navigations } = renderPopover(
      '/?search=printer&page=3',
    );
    await openPopover(user);

    await user.click(screen.getByRole('radio', { name: 'Closed' }));
    await user.click(screen.getByRole('switch', { name: 'Remote only' }));
    await pick(user, 'Region', 'Europe');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(navigations()).toBe(1));
    expect(Object.fromEntries(searchParams())).toEqual({
      search: 'printer',
      status: 'closed',
      remote: 'true',
      region: 'eu',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('drops the draft when closed without Apply', async () => {
    const { user, searchParams, navigations } = renderPopover('/?region=eu');
    await openPopover(user);

    await user.click(screen.getByRole('radio', { name: 'Closed' }));
    await pick(user, 'Region', 'North America');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(navigations()).toBe(0);
    expect(searchParams().toString()).toBe('region=eu');

    const popup = within(await openPopover(user));
    expect(popup.getByRole('radio', { name: 'Open' })).toBeChecked();
    expect(popup.getByRole('combobox', { name: 'Region' })).toHaveTextContent(
      'Europe',
    );
  });

  it('clears a whole chain of dependents when a parent changes', async () => {
    const { user, searchParams } = renderPopover(
      '/?region=eu&country=de&city=berlin',
    );
    const popup = within(await openPopover(user));
    expect(popup.getByRole('combobox', { name: 'City' })).toHaveTextContent(
      'Berlin',
    );

    await pick(user, 'Region', 'North America');

    expect(popup.getByRole('combobox', { name: 'Country' })).toHaveTextContent(
      'All',
    );
    // City waits for a country again.
    expect(
      popup.queryByRole('combobox', { name: 'City' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(searchParams().toString()).toBe('region=na'));
  });

  it('hides a dependent until its parent has a value', async () => {
    const { user } = renderPopover();
    const popup = within(await openPopover(user));

    expect(popup.queryByRole('combobox', { name: 'Country' })).toBeNull();

    await pick(user, 'Region', 'Europe');

    expect(popup.getByRole('combobox', { name: 'Country' })).toBeVisible();
    expect(popup.queryByRole('combobox', { name: 'City' })).toBeNull();
  });

  it('clears only its own fields', async () => {
    const { user, searchParams, navigations } = renderPopover(
      '/?search=printer&tab=notes&status=closed&tag=a&region=eu&remote=true&page=2',
    );
    await openPopover(user);

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() =>
      expect(searchParams().toString()).toBe('search=printer&tab=notes'),
    );
    expect(navigations()).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('counts fields off their default in the trigger name', async () => {
    const { user, navigate } = renderPopover();
    expect(trigger()).toHaveAccessibleName('Filters');

    await navigate('/?status=open&search=printer&page=2');
    expect(trigger()).toHaveAccessibleName('Filters');

    await navigate('/?status=open&region=eu&tag=a&tag=b');
    expect(trigger()).toHaveAccessibleName('Filters, 2 applied');

    await openPopover(user);
    await user.click(screen.getByRole('radio', { name: 'Closed' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(trigger()).toHaveAccessibleName('Filters, 3 applied'),
    );
  });

  it('leaves a value on its default out of the URL', async () => {
    const { user, searchParams } = renderPopover('/?status=closed');
    await openPopover(user);

    await user.click(screen.getByRole('radio', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(searchParams().has('status')).toBe(false));
  });

  it('writes a picked async option and nothing for "All"', async () => {
    servePeople();
    const { user, searchParams } = renderPopover();
    await openPopover(user);

    await pick(user, 'Owner', 'Alice');
    await user.click(within(dialog()).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(searchParams().get('owner')).toBe('alice'));

    await openPopover(user);
    await pick(user, 'Owner', 'All');
    await user.click(within(dialog()).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(searchParams().has('owner')).toBe(false));
  });

  it('ends the multi-select in a chevron that opens the list', async () => {
    const { user } = renderPopover();
    const popup = within(await openPopover(user));
    const chevron = popup.getByRole('button', { name: 'Show options' });

    expect(chevron.querySelector('svg[class*="chevron-down"]')).not.toBeNull();
    await user.click(chevron);
    expect(
      await screen.findByRole('option', { name: 'Alpha' }),
    ).toBeInTheDocument();
  });

  it('writes a list field as repeated params', async () => {
    const { user, searchParams } = renderPopover();
    await openPopover(user);

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    await user.click(await screen.findByRole('option', { name: 'Alpha' }));
    await user.click(await screen.findByRole('option', { name: 'Beta' }));
    // Closes the tag list, and only the tag list.
    await user.keyboard('{Escape}');
    await user.click(within(dialog()).getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(searchParams().getAll('tag')).toEqual(['a', 'b']),
    );
  });
});

describe('dependentsOf', () => {
  it('follows a chain and ignores unrelated fields', () => {
    const fields = [
      { key: 'a' },
      { key: 'b', dependsOn: 'a' },
      { key: 'c', dependsOn: 'b' },
      { key: 'd', dependsOn: 'c' },
      { key: 'x' },
      { key: 'y', dependsOn: 'x' },
    ];

    expect(dependentsOf(fields, 'a')).toEqual(['b', 'c', 'd']);
    expect(dependentsOf(fields, 'c')).toEqual(['d']);
    expect(dependentsOf(fields, 'd')).toEqual([]);
  });
});
