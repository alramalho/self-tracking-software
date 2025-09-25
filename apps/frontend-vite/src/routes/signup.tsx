import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/clerk-react'
import AuthLayout from '@/components/AuthLayout'

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

  return (
    <AuthLayout>
      <SignUp
        signInUrl={redirect_url ? `/signin?redirect_url=${redirect_url}` : "/signin"}
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