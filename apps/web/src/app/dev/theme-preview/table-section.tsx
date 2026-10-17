import { Archive, Copy, Eye, Lock, Trash2, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useConfirm } from '@/systems/confirmation';
import { useUrlFilters } from '@/systems/filters';
import { createColumnHelper, DataTable, RowLink } from '@/systems/table';
import {
  EmptyState,
  LookupBadge,
  RowActions,
  RowActionsMenu,
} from '@/systems/ui';
import { PreviewSection, PreviewSwitch } from './preview-layout';
import {
  countryLabel,
  departmentLabel,
  filterPeople,
  pagePeople,
  personName,
  PREVIEW_FILTER_SPEC,
  previewStatusLookup,
  type PreviewPerson,
} from './preview-data';

const helper = createColumnHelper<PreviewPerson>();

export function TableSection() {
  const { filters, setFilter, isFiltered, resetFilters } =
    useUrlFilters(PREVIEW_FILTER_SPEC);
  const confirm = useConfirm();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  const result = useMemo(
    () =>
      pagePeople(
        isEmpty ? [] : filterPeople(filters),
        filters.page,
        filters.limit,
      ),
    [filters, isEmpty],
  );

  const columns = useMemo(() => {
    const remove = (person: PreviewPerson) =>
      confirm({
        title: `Delete ${person.name}?`,
        description: 'Nothing is deleted, this is the preview page.',
        variant: 'destructive',
        onConfirm: () => {
          toast.success(`${person.name} deleted`);
        },
      });

    return helper.columns([
      helper.accessor('code', {
        header: 'Code',
        meta: { sticky: 'left', size: 112 },
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ),
      }),
      helper.accessor('name', {
        header: 'Name',
        meta: { sticky: 'left', size: 200 },
        // No detail route exists, so these land on the 404 page.
        cell: (info) => (
          <RowLink to={`/dev/people/${info.row.original.id}`}>
            {info.getValue()}
          </RowLink>
        ),
      }),
      helper.accessor('email', {
        header: 'Email',
        meta: { hideBelow: 'md' },
      }),
      helper.accessor('phone', {
        header: 'Phone',
        meta: { hideBelow: 'sm' },
        cell: (info) => (
          <span className="whitespace-nowrap tabular-nums">
            {info.getValue()}
          </span>
        ),
      }),
      helper.accessor('department', {
        header: 'Department',
        cell: (info) => departmentLabel(info.getValue()),
      }),
      helper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <LookupBadge lookup={previewStatusLookup} value={info.getValue()} />
        ),
      }),
      helper.accessor('city', {
        header: 'City',
        meta: { hideBelow: 'lg' },
      }),
      helper.accessor('country', {
        header: 'Country',
        meta: { hideBelow: 'lg' },
        cell: (info) => countryLabel(info.getValue()),
      }),
      helper.accessor('startDate', {
        header: 'Start date',
        cell: (info) => (
          <span className="whitespace-nowrap">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      helper.accessor('salary', {
        header: 'Salary',
        meta: { align: 'right' },
        cell: (info) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      helper.accessor('managerId', {
        header: 'Manager',
        cell: (info) => (
          <span className="whitespace-nowrap">
            {personName(info.getValue())}
          </span>
        ),
      }),
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">Edit or delete</span>,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActions
            subject={row.original.name}
            onEdit={() => toast(`Edit ${row.original.name}`)}
            onDelete={() => remove(row.original)}
          />
        ),
      }),
      helper.display({
        id: 'menu',
        header: () => <span className="sr-only">More actions</span>,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActionsMenu
            subject={row.original.name}
            actions={[
              {
                label: 'View',
                icon: Eye,
                onSelect: () => toast(`View ${row.original.name}`),
              },
              {
                label: 'Duplicate',
                icon: Copy,
                onSelect: () => toast(`Duplicate ${row.original.name}`),
              },
              {
                label: 'Archive',
                icon: Archive,
                onSelect: () =>
                  confirm({
                    title: `Archive ${row.original.name}?`,
                    description: 'They drop out of every list until restored.',
                    variant: 'warning',
                    confirmText: 'Archive',
                    onConfirm: () => {
                      toast.success(`${row.original.name} archived`);
                    },
                  }),
              },
              {
                label: 'Lock',
                icon: Lock,
                onSelect: () => undefined,
                disabled: true,
              },
              {
                label: 'Delete',
                icon: Trash2,
                variant: 'destructive',
                onSelect: () => remove(row.original),
              },
            ]}
          />
        ),
      }),
    ]);
  }, [confirm]);

  return (
    // A list page sets --table-offset to everything above and below its
    // table, so the table's own scrollbars stay on screen. Here that is the
    // shell header and padding plus this section's heading, toggles and the
    // pagination row, once a jump link has brought the section to the top.
    <PreviewSection
      id="table"
      description="DataTable on the filter spec above: two sized sticky columns, a right-aligned money column, hideBelow columns, RowLink, RowActions and RowActionsMenu. Rows open a toast on click."
      className="[--table-offset:calc(var(--header-height)+var(--page-padding)+21rem)] sm:[--table-offset:calc(var(--header-height)+var(--page-padding)+15.5rem)]"
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <PreviewSwitch
          label="Loading"
          checked={isLoading}
          onCheckedChange={setIsLoading}
        />
        <PreviewSwitch
          label="Fetching"
          checked={isFetching}
          onCheckedChange={setIsFetching}
        />
        <PreviewSwitch
          label="Empty"
          checked={isEmpty}
          onCheckedChange={setIsEmpty}
        />
      </div>

      <DataTable
        columns={columns}
        data={isLoading ? [] : result.data}
        label="People"
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={isLoading ? undefined : result.pagination}
        onPageChange={(page) => setFilter('page', page)}
        onLimitChange={(limit) => setFilter('limit', limit)}
        onRowClick={(person) => toast(`Row clicked: ${person.name}`)}
        emptyState={
          isFiltered ? (
            <EmptyState
              icon={Users}
              title="No people match"
              description="Nobody fits these filters."
              level={3}
              action={
                <Button type="button" variant="outline" onClick={resetFilters}>
                  <X />
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No people yet"
              description="Turn off Empty to see the rows."
              level={3}
            />
          )
        }
      />
    </PreviewSection>
  );
}
