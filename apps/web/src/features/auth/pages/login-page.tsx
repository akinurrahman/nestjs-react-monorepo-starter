import { loginSchema, type LoginInput } from '@starter/shared';
import { Navigate, useSearchParams } from 'react-router';
import { safeRedirect } from '@/lib/safe-redirect';
import { Form, FormActions, FormError, formFields } from '@/systems/form';
import { useSession } from '@/systems/session';
import { useLogin } from '../api/auth.mutations';
import { LOGIN_PATH, REDIRECT_PARAM } from '../definitions/auth.constants';

const Field = formFields(loginSchema);

// The email schema is a pipe, which the form cannot seed an empty value for.
const DEFAULT_VALUES: LoginInput = { email: '', password: '' };

// Never back to /login itself, which would bounce a signed-in user forever.
function redirectTarget(value: string | null): string {
  const target = safeRedirect(value);
  return target.split(/[?#]/)[0] === LOGIN_PATH ? '/' : target;
}

export default function LoginPage() {
  const { user } = useSession();
  const [searchParams] = useSearchParams();
  const login = useLogin();

  // Also how a successful login leaves: the mutation stores the user and this
  // renders again, so the submit never navigates itself.
  if (user) {
    return (
      <Navigate replace to={redirectTarget(searchParams.get(REDIRECT_PARAM))} />
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the email and password for your account.
        </p>
        <Form
          schema={loginSchema}
          defaultValues={DEFAULT_VALUES}
          onSubmit={(values) => login.mutateAsync(values)}
          className="mt-6 grid gap-5"
        >
          <Field.Input
            name="email"
            label="Email"
            type="email"
            autoComplete="username"
            required
          />
          <Field.Input
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />
          <FormError />
          <FormActions
            submitLabel="Sign in"
            pendingLabel="Signing in"
            isPending={login.isPending}
            className="*:w-full"
          />
        </Form>
      </div>
    </main>
  );
}
