import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth, useUser } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: HomePage
})

function HomePage() {
  const { signOut } = useAuth()
  const { user, isSignedIn } = useUser()

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Tracking.so</h1>
      <p className="text-gray-600 mb-6">Migration in progress...</p>

      {isSignedIn ? (
        <div className="space-y-4">
          <p className="text-green-600">✅ Signed in as: {user?.primaryEmailAddress?.emailAddress}</p>
          <Button onClick={() => signOut()} variant="outline">
            Sign Out
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">Not signed in</p>
          <div className="flex gap-4">
            <Link to="/signin" search={{ redirect_url: undefined }}>
              <Button>Sign In</Button>
            </Link>
            <Button variant="outline" onClick={() => window.location.href = '/signup'}>
              Sign Up
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Test Routes:</h2>
        <div className="flex flex-col gap-2">
          <Link to="/download" search={{ instagram: false, tiktok: false }} className="text-blue-500 hover:underline w-fit">
            📱 Test /download route
          </Link>
          <Link to="/signin" search={{ redirect_url: undefined }} className="text-blue-500 hover:underline w-fit">
            🔐 Test /signin route (Clerk Auth)
          </Link>
          <Link to="/signout" className="text-blue-500 hover:underline w-fit">
            🚪 Test /signout route
          </Link>
          <Link to="/plans" className="text-blue-500 hover:underline w-fit">
            📋 Test /plans route (Basic)
          </Link>
        </div>
      </div>
    </div>
  )
}