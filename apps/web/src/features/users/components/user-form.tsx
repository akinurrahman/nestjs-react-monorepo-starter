import { createUserSchema, type CreateUserInput } from '@starter/shared';
import { Form, FormActions, FormError, formFields } from '@/systems/form';
import { useCreateUser, useUpdateUser } from '../api/user.mutations';
import { userRoleLookup } from '../definitions/user.lookup';
import {
  userEditFormSchema,
  type UserEditFormInput,
} from '../definitions/user.schema';
import type { User } from '../definitions/user.types';

const CreateField = formFields(createUserSchema);
// Its keys are a subset of the create schema's, so it serves both forms.
const Field = formFields(userEditFormSchema);

// The email schema is a pipe, which the form cannot seed an empty value for.
const CREATE_DEFAULTS: CreateUserInput = {
  email: '',
  name: '',
  role: userRoleLookup.keys.USER,
  password: '',
};

type UserFormProps = {
  initialData?: User;
  // Editing your own account: the role shows but cannot change.
  isSelf?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

export function UserForm({
  initialData,
  isSelf = false,
  onSuccess,
  onCancel,
}: UserFormProps) {
  return initialData ? (
    <EditUserForm
      user={initialData}
      isSelf={isSelf}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  ) : (
    <CreateUserForm onSuccess={onSuccess} onCancel={onCancel} />
  );
}

function SharedFields({ isSelf = false }: { isSelf?: boolean }) {
  return (
    <>
      <Field.Input name="name" label="Name" autoComplete="off" required />
      <Field.Input
        name="email"
        label="Email"
        type="email"
        autoComplete="off"
        required
      />
      <Field.Select
        name="role"
        label="Role"
        options={userRoleLookup.options}
        disabled={isSelf}
        description={isSelf ? 'You cannot change your own role.' : undefined}
        required
      />
    </>
  );
}

function CreateUserForm({
  onSuccess,
  onCancel,
}: Omit<UserFormProps, 'initialData' | 'isSelf'>) {
  const createUser = useCreateUser();

  return (
    <Form
      schema={createUserSchema}
      defaultValues={CREATE_DEFAULTS}
      onSubmit={async (values) => {
        await createUser.mutateAsync(values);
        onSuccess();
      }}
      className="grid max-w-xl gap-5"
    >
      <SharedFields />
      <CreateField.Input
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
      />
      <FormError />
      <FormActions
        submitLabel="Create user"
        pendingLabel="Creating"
        isPending={createUser.isPending}
        onCancel={onCancel}
      />
    </Form>
  );
}

function EditUserForm({
  user,
  isSelf,
  onSuccess,
  onCancel,
}: Omit<UserFormProps, 'initialData'> & { user: User }) {
  const updateUser = useUpdateUser(user.id);
  const defaultValues: UserEditFormInput = {
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return (
    <Form
      schema={userEditFormSchema}
      defaultValues={defaultValues}
      onSubmit={async (values) => {
        await updateUser.mutateAsync(values);
        onSuccess();
      }}
      className="grid max-w-xl gap-5"
    >
      <SharedFields isSelf={isSelf} />
      <FormError />
      <FormActions
        submitLabel="Save changes"
        isPending={updateUser.isPending}
        onCancel={onCancel}
      />
    </Form>
  );
}
