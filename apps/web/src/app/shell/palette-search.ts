export type Searchable = {
  title: string;
  keywords: readonly string[];
};

export type SearchGroup<Item> = {
  label: string;
  items: readonly Item[];
};

const normalize = (text: string) => text.trim().toLocaleLowerCase();

// Lower is better, -1 is no match.
function score(item: Searchable, query: string, groupMatches: boolean) {
  const title = normalize(item.title);
  if (title.startsWith(query)) return 0;
  if (title.includes(query)) return 1;
  if (
    groupMatches ||
    item.keywords.some((keyword) => normalize(keyword).includes(query))
  ) {
    return 2;
  }
  return -1;
}

/**
 * Groups keep their order. Within a group, while there is a query: titles
 * that start with it, then titles that contain it, then items whose group or
 * keywords contain it. Ties keep the incoming order, which for pages is the
 * sidebar's. Groups left empty are dropped. No query returns the groups as
 * they came.
 */
export function searchGroups<Item extends Searchable>(
  groups: readonly SearchGroup<Item>[],
  rawQuery: string,
): SearchGroup<Item>[] {
  const query = normalize(rawQuery);
  if (!query) return [...groups];

  return groups.flatMap((group) => {
    const groupMatches = normalize(group.label).includes(query);
    const items = group.items
      .map((item, index) => ({
        item,
        index,
        rank: score(item, query, groupMatches),
      }))
      .filter((entry) => entry.rank !== -1)
      .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
      .map((entry) => entry.item);
    return items.length > 0 ? [{ label: group.label, items }] : [];
  });
}
