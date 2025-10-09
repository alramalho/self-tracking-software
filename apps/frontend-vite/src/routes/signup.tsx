import AuthLayout from '@/components/AuthLayout'
import { SignUp } from '@/components/SignUp'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/signup')({
  component: SignUpPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect_url: typeof search.redirect_url === 'string' ? search.redirect_url : undefined,
    }
  },
})

function SignUpPage() {
  const { redirect_url } = Route.useSearch()
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <SignUp
        onSuccess={() => {
          navigate({ to: redirect_url ?? "/" });
        }}
      />
    </AuthLayout>
  );
}