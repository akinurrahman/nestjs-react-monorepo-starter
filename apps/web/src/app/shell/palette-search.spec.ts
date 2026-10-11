import { searchGroups, type SearchGroup } from './palette-search';

type Item = { title: string; keywords: readonly string[] };

const item = (title: string, keywords: string[] = []): Item => ({
  title,
  keywords,
});

const titles = (groups: SearchGroup<Item>[]) =>
  groups.map((group) => [group.label, group.items.map((i) => i.title)]);

const groups: SearchGroup<Item>[] = [
  {
    label: 'General',
    items: [
      item('Home'),
      item('Team reports'),
      item('Payroll', ['report', 'salary']),
      item('Reports'),
      item('Report builder'),
    ],
  },
  {
    label: 'People',
    items: [item('Employees'), item('Reporting lines')],
  },
];

describe('searchGroups', () => {
  it('keeps sidebar order without a query', () => {
    expect(titles(searchGroups(groups, '  '))).toEqual(titles(groups));
  });

  it('ranks title prefix, then title contains, then keyword, in each group', () => {
    expect(titles(searchGroups(groups, 'rep'))).toEqual([
      ['General', ['Reports', 'Report builder', 'Team reports', 'Payroll']],
      ['People', ['Reporting lines']],
    ]);
  });

  it('keeps sidebar order between equal matches', () => {
    // Reports and Report builder both start with the query; Reports comes
    // first in the sidebar.
    const [general] = searchGroups(groups, 'report');
    expect(general?.items.slice(0, 2).map((i) => i.title)).toEqual([
      'Reports',
      'Report builder',
    ]);
  });

  it('keeps group order even when a later group matches better', () => {
    const result = searchGroups(
      [
        { label: 'General', items: [item('Payroll', ['staff'])] },
        { label: 'People', items: [item('Staff directory')] },
      ],
      'staff',
    );
    expect(result.map((g) => g.label)).toEqual(['General', 'People']);
  });

  it('matches the group label after any title match', () => {
    expect(titles(searchGroups(groups, 'peop'))).toEqual([
      ['People', ['Employees', 'Reporting lines']],
    ]);
  });

  it('ignores case and surrounding spaces', () => {
    expect(titles(searchGroups(groups, '  HOME '))).toEqual([
      ['General', ['Home']],
    ]);
  });

  it('drops groups with nothing left', () => {
    expect(searchGroups(groups, 'zzz')).toEqual([]);
  });
});
