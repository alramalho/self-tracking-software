import AuthLayout from '@/components/AuthLayout';
import { SignIn } from '@/components/SignIn';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/signin')({
  component: SignInPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect_url:
        typeof search.redirect_url === "string"
          ? search.redirect_url
          : undefined,
    };
  },
});

function SignInPage() {
  const { redirect_url } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <SignIn
        onSuccess={() => {
          navigate({ to: redirect_url ?? "/" });
        }}
      />
    </AuthLayout>
  );
}