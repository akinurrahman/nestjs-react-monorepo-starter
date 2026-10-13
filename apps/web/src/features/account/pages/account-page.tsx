import { updateMeSchema, type PublicUser } from '@starter/shared';
import { Form, FormActions, FormError, formFields } from '@/systems/form';
import { useSession } from '@/systems/session';
import { PageHeader, PanelSection } from '@/systems/ui';
import { useChangePassword, useUpdateProfile } from '../api/account.mutations';
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from '../definitions/account.schema';

const ProfileField = formFields(updateMeSchema);
const PasswordField = formFields(changePasswordFormSchema);

const PASSWORD_DEFAULTS: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

export default function AccountPage() {
  const { user } = useSession();
  // The route needs a signed-in user, so this only covers the frame in which
  // a sign-out lands.
  if (!user) return null;

  return (
    <>
      <PageHeader title="Account" description={user.email} />
      <div className="grid max-w-xl gap-6">
        <ProfileSection user={user} />
        <PasswordSection />
      </div>
    </>
  );
}

function ProfileSection({ user }: { user: PublicUser }) {
  const updateProfile = useUpdateProfile();

  return (
    <PanelSection title="Profile" description="How you appear to others.">
      <Form
        schema={updateMeSchema}
        defaultValues={{ name: user.name }}
        onSubmit={(values) => updateProfile.mutateAsync(values)}
        className="grid gap-5"
      >
        <ProfileField.Input
          name="name"
          label="Name"
          autoComplete="name"
          required
        />
        <FormError />
        <FormActions
          submitLabel="Save profile"
          isPending={updateProfile.isPending}
        />
      </Form>
    </PanelSection>
  );
}

function PasswordSection() {
  const changePassword = useChangePassword();

  return (
    <PanelSection
      title="Password"
      description="Changing it signs you out on every other device."
    >
      <Form
        schema={changePasswordFormSchema}
        defaultValues={PASSWORD_DEFAULTS}
        onSubmit={async (values, form) => {
          await changePassword.mutateAsync(values);
          form.reset();
        }}
        className="grid gap-5"
      >
        <PasswordField.Input
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
        />
        <PasswordField.Input
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
        />
        <PasswordField.Input
          name="confirmNewPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
        />
        <FormError />
        <FormActions
          submitLabel="Change password"
          isPending={changePassword.isPending}
        />
      </Form>
    </PanelSection>
  );
}
