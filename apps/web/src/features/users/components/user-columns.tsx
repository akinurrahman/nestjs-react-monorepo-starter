import { KeyRound, Pencil, UserCheck, UserX } from 'lucide-react';
import { formatDate } from '@/lib/date';
import { createColumnHelper, RowLink } from '@/systems/table';
import { LookupBadge, RowActionsMenu, type RowAction } from '@/systems/ui';
import { userRoleLookup, userStatusLookup } from '../definitions/user.lookup';
import type { User } from '../definitions/user.types';

const helper = createColumnHelper<User>();

type UserColumnsOptions = {
  // The signed-in admin. Their own row has no disable action, and changes
  // its password through onChangeOwnPassword: the api refuses the admin
  // set-password route for the caller.
  currentUserId: string | undefined;
  editPath: (user: User) => string;
  onEdit: (user: User) => void;
  onSetPassword: (user: User) => void;
  onChangeOwnPassword: () => void;
  onEnable: (user: User) => void;
  onDisable: (user: User) => void;
};

const statusOf = (user: User) =>
  user.isActive ? userStatusLookup.keys.active : userStatusLookup.keys.disabled;

export function userColumns({
  currentUserId,
  editPath,
  onEdit,
  onSetPassword,
  onChangeOwnPassword,
  onEnable,
  onDisable,
}: UserColumnsOptions) {
  const actionsFor = (user: User): RowAction[] => {
    const actions: RowAction[] = [
      { label: 'Edit', icon: Pencil, onSelect: () => onEdit(user) },
      user.id === currentUserId
        ? {
            label: 'Change password',
            icon: KeyRound,
            onSelect: onChangeOwnPassword,
          }
        : {
            label: 'Set password',
            icon: KeyRound,
            onSelect: () => onSetPassword(user),
          },
    ];
    if (!user.isActive) {
      actions.push({
        label: 'Enable',
        icon: UserCheck,
        onSelect: () => onEnable(user),
      });
    } else if (user.id !== currentUserId) {
      actions.push({
        label: 'Disable',
        icon: UserX,
        variant: 'destructive',
        onSelect: () => onDisable(user),
      });
    }
    return actions;
  };

  return helper.columns([
    helper.accessor('name', {
      header: 'Name',
      meta: { sticky: 'left', size: 200 },
      cell: (info) => (
        <RowLink to={editPath(info.row.original)}>{info.getValue()}</RowLink>
      ),
    }),
    helper.accessor('email', {
      header: 'Email',
      meta: { hideBelow: 'md' },
    }),
    helper.accessor('role', {
      header: 'Role',
      cell: (info) => (
        <LookupBadge lookup={userRoleLookup} value={info.getValue()} />
      ),
    }),
    helper.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <LookupBadge lookup={userStatusLookup} value={statusOf(row.original)} />
      ),
    }),
    helper.accessor('createdAt', {
      header: 'Created',
      meta: { hideBelow: 'sm' },
      cell: (info) => (
        <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>
      ),
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <RowActionsMenu
          subject={row.original.name}
          actions={actionsFor(row.original)}
        />
      ),
    }),
  ]);
}
