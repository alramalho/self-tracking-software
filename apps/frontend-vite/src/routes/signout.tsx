import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'

export const Route = createFileRoute('/signout')({
  component: SignOutPage
})

function SignOutPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const performSignOut = async () => {
      try {
        await signOut()
        // Redirect to signin after successful signout
        navigate({ to: '/signin', search: { redirect_url: undefined } })
      } catch (error) {
        console.error('Error signing out:', error)
        // Still redirect to signin even if there's an error
        navigate({ to: '/signin', search: { redirect_url: undefined } })
      }
    }

    performSignOut()
  }, [signOut, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you out...</p>
      </div>
    </div>
  )
}