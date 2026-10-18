import { useNavigate, useParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/api-error';
import { useSession } from '@/systems/session';
import { ErrorState, NotFoundState, PageHeader } from '@/systems/ui';
import { useUser } from '../api/user.queries';
import { UserForm } from '../components/user-form';

export default function UserFormPage() {
  const { id } = useParams();
  return id ? <EditUser id={id} /> : <CreateUser />;
}

function CreateUser() {
  const navigate = useNavigate();
  const back = () => void navigate('/users');

  return (
    <>
      <PageHeader title="New user" />
      <UserForm onSuccess={back} onCancel={back} />
    </>
  );
}

function EditUser({ id }: { id: string }) {
  const navigate = useNavigate();
  const back = () => void navigate('/users');
  const currentUserId = useSession().user?.id;
  const { data: user, error, isLoadingError, isLoading, refetch } = useUser(id);

  // A malformed id is a 400 from the param check, a missing user a 404.
  if (isLoadingError && isApiError(error) && [400, 404].includes(error.status))
    return <NotFoundState />;
  if (isLoadingError)
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading) {
    return (
      <output aria-label="Loading user" className="block">
        <Skeleton className="h-96 w-full max-w-xl" />
      </output>
    );
  }
  if (!user) return <NotFoundState />;

  return (
    <>
      <PageHeader title={`Edit ${user.name}`} />
      <UserForm
        initialData={user}
        isSelf={user.id === currentUserId}
        onSuccess={back}
        onCancel={back}
      />
    </>
  );
}
