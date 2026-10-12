// What a cleared control holds: nothing, an empty string, or an empty list.
// A cascade parent with one of these gates its children, and a filter with
// one of these is not applied. null counts, since a cleared Base UI select
// hands back null.
export function isEmptyValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === '';
}
