import {
  createColumnHelper as createTableColumnHelper,
  metaHelper,
  tableFeatures,
  type ColumnDef as TableColumnDef,
  type RowData,
} from '@tanstack/react-table';

export type DataTableColumnMeta = {
  // One setting for the header, the cells and the skeleton, so a money
  // column never gets a left-aligned label over right-aligned figures.
  align?: 'left' | 'right' | 'center';
  // Width in px. A sticky column's left offset is the sum of the sticky
  // columns before it, so every sticky column but the last needs one.
  size?: number;
  hideBelow?: 'sm' | 'md' | 'lg';
  // Leading columns only. A sticky column after a scrolling one is ignored
  // and warned about in development.
  sticky?: 'left';
};

// Sorting, filtering and paging all happen on the server, so the table
// registers no optional features, only the typed meta slot.
export const dataTableFeatures = tableFeatures({
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

type DataTableFeatures = typeof dataTableFeatures;

export type ColumnDef<TData extends RowData> = TableColumnDef<
  DataTableFeatures,
  TData,
  any
>;

export function createColumnHelper<TData extends RowData>() {
  return createTableColumnHelper<DataTableFeatures, TData>();
}
