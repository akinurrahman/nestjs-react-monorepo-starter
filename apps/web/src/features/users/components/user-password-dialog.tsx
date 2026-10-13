import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormActions, FormError, formFields } from '@/systems/form';
import { useSetUserPassword } from '../api/user.mutations';
import {
  userPasswordFormSchema,
  type UserPasswordFormValues,
} from '../definitions/user.schema';
import type { User } from '../definitions/user.types';

const Field = formFields(userPasswordFormSchema);

const DEFAULT_VALUES: UserPasswordFormValues = {
  password: '',
  confirmPassword: '',
};

type UserPasswordDialogProps = {
  // The dialog is open while this is set.
  user: User | null;
  onClose: () => void;
};

export function UserPasswordDialog({ user, onClose }: UserPasswordDialogProps) {
  const setPassword = useSetUserPassword(user?.id ?? '');

  return (
    <Dialog
      open={user !== null}
      // Escape or the backdrop mid-write would drop the result on nothing.
      onOpenChange={(open) => {
        if (!open && !setPassword.isPending) onClose();
      }}
    >
      <DialogContent>
        {user ? (
          <PasswordForm user={user} mutation={setPassword} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type PasswordFormProps = {
  user: User;
  mutation: ReturnType<typeof useSetUserPassword>;
  onClose: () => void;
};

function PasswordForm({
  user,
  mutation: setPassword,
  onClose,
}: PasswordFormProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Set password for {user.name}</DialogTitle>
        <DialogDescription>
          They are signed out everywhere and use the new password next time.
        </DialogDescription>
      </DialogHeader>
      <Form
        schema={userPasswordFormSchema}
        defaultValues={DEFAULT_VALUES}
        onSubmit={async (values) => {
          await setPassword.mutateAsync(values);
          onClose();
        }}
        className="grid gap-5"
      >
        <Field.Input
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
        />
        <Field.Input
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
        />
        <FormError />
        <FormActions
          submitLabel="Set password"
          isPending={setPassword.isPending}
          onCancel={onClose}
        />
      </Form>
    </>
  );
}
