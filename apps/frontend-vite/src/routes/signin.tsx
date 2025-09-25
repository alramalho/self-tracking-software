import AuthLayout from '@/components/AuthLayout'
import { SignIn } from '@/components/SignIn'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/signin')({
  component: SignInPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect_url: typeof search.redirect_url === 'string' ? search.redirect_url : undefined,
    }
  },
})

function SignInPage() {
  const { redirect_url } = Route.useSearch()

  return (
    <AuthLayout>
      <SignIn
        signUpUrl={redirect_url ? `/signup?redirect_url=${redirect_url}` : "/signup"}
        forceRedirectUrl={redirect_url}
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none",
          }
        }}
      />
    </AuthLayout>
  )
}