import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  FilterAsyncSelect,
  FilterBar,
  FilterPopover,
  FilterSelect,
  SearchInput,
  useUrlFilters,
  type FilterPopoverField,
} from '@/systems/filters';
import { PreviewSection } from './preview-layout';
import {
  COUNTRY_OPTIONS,
  countrySource,
  DEPARTMENTS,
  peopleSource,
  personName,
  PREVIEW_FILTER_SPEC,
  previewStatusLookup,
  REGIONS,
  type PreviewFilters,
} from './preview-data';

const POPOVER_FIELDS: FilterPopoverField<PreviewFilters>[] = [
  {
    key: 'departments',
    label: 'Departments',
    type: 'multiSelect',
    options: DEPARTMENTS,
    span: 'full',
  },
  { key: 'region', label: 'Region', type: 'select', options: REGIONS },
  {
    key: 'country',
    label: 'Country',
    type: 'asyncSelect',
    source: countrySource,
    initialOptions: COUNTRY_OPTIONS,
    dependsOn: 'region',
    alwaysVisible: true,
  },
];

export function FiltersSection() {
  const { filters, setFilter, isFiltered, resetFilters, searchParams } =
    useUrlFilters(PREVIEW_FILTER_SPEC);
  const query = searchParams.toString();

  return (
    <PreviewSection
      id="filters"
      description="A FilterBar on a real URL filter spec. It drives the table below. The popover holds a multi-select and a Region to Country cascade."
    >
      <FilterBar
        isFiltered={isFiltered}
        onReset={resetFilters}
        actions={
          <Button
            type="button"
            className="h-10 sm:h-9"
            onClick={() => toast('Add person clicked')}
          >
            <Plus />
            Add person
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
          placeholder="Search people"
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => setFilter('status', value)}
          options={previewStatusLookup.options}
          placeholder="Status"
          allLabel="All statuses"
        />
        <FilterAsyncSelect
          value={filters.manager}
          onChange={(value) => setFilter('manager', value)}
          source={peopleSource}
          initialOptions={
            filters.manager
              ? [{ value: filters.manager, label: personName(filters.manager) }]
              : undefined
          }
          placeholder="Manager"
          allLabel="All managers"
        />
        <FilterPopover spec={PREVIEW_FILTER_SPEC} fields={POPOVER_FIELDS} />
      </FilterBar>

      <p className="text-sm break-all text-muted-foreground">
        URL: <code className="font-mono text-xs">?{query}</code>
      </p>
    </PreviewSection>
  );
}
