// Postgres text cannot hold U+0000, so a value with one would fail at the
// database instead of in validation.
export const hasNoNullChar = (value: string): boolean => !value.includes('\0');
