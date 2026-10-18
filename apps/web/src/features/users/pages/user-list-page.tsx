import { USER_SEARCH_MAX_LENGTH } from '@starter/shared';
import { Plus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ACCOUNT_PATH } from '@/features/account';
import { useConfirm } from '@/systems/confirmation';
import {
  FilterBar,
  FilterPopover,
  FilterSelect,
  SearchInput,
  useUrlFilters,
  type FilterPopoverField,
} from '@/systems/filters';
import { useSession } from '@/systems/session';
import { DataTable } from '@/systems/table';
import { EmptyState, ErrorState, PageHeader } from '@/systems/ui';
import { useDisableUser, useEnableUser } from '../api/user.mutations';
import { useUserList } from '../api/user.queries';
import { userColumns } from '../components/user-columns';
import { UserPasswordDialog } from '../components/user-password-dialog';
import { USER_FILTER_SPEC } from '../definitions/user.constants';
import { userRoleLookup, userStatusLookup } from '../definitions/user.lookup';
import type { User, UserFilters } from '../definitions/user.types';

const POPOVER_FIELDS: FilterPopoverField<UserFilters>[] = [
  {
    key: 'role',
    label: 'Role',
    type: 'multiSelect',
    options: userRoleLookup.options,
    span: 'full',
  },
];

const editPath = (user: User) => `/users/${user.id}/edit`;

export default function UserListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const currentUserId = useSession().user?.id;
  const { filters, setFilter, isFiltered, resetFilters } =
    useUrlFilters(USER_FILTER_SPEC);
  const { data, error, isLoadingError, isLoading, isFetching, refetch } =
    useUserList(filters);
  const disableUser = useDisableUser();
  const enableUser = useEnableUser();
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  const columns = userColumns({
    currentUserId,
    editPath,
    onEdit: (user) => void navigate(editPath(user)),
    onSetPassword: setPasswordUser,
    onChangeOwnPassword: () => void navigate(ACCOUNT_PATH),
    onEnable: (user) =>
      confirm({
        title: `Enable ${user.name}?`,
        description: 'They can sign in again.',
        confirmText: 'Enable',
        pendingText: 'Enabling',
        onConfirm: async () => {
          await enableUser.mutateAsync(user);
        },
      }),
    onDisable: (user) =>
      confirm({
        title: `Disable ${user.name}?`,
        description:
          'They are signed out everywhere and cannot sign in until enabled.',
        variant: 'destructive',
        confirmText: 'Disable',
        pendingText: 'Disabling',
        onConfirm: async () => {
          await disableUser.mutateAsync(user);
        },
      }),
  });

  if (isLoadingError)
    return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader title="Users" description="Who can sign in, and as what." />

      <FilterBar
        isFiltered={isFiltered}
        onReset={resetFilters}
        actions={
          <Button onClick={() => void navigate('/users/new')}>
            <Plus />
            New user
          </Button>
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
          placeholder="Search name or email"
          maxLength={USER_SEARCH_MAX_LENGTH}
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => setFilter('status', value)}
          options={userStatusLookup.options}
          placeholder="Status"
          allLabel="All statuses"
        />
        <FilterPopover spec={USER_FILTER_SPEC} fields={POPOVER_FIELDS} />
      </FilterBar>

      <DataTable
        label="Users"
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={data?.pagination}
        onPageChange={(page) => setFilter('page', page)}
        onLimitChange={(limit) => setFilter('limit', limit)}
        emptyState={
          isFiltered ? (
            <EmptyState
              icon={Users}
              title="No users match"
              description="Nobody fits these filters."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <X />
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Create the first one."
            />
          )
        }
      />

      <UserPasswordDialog
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
      />
    </>
  );
}
