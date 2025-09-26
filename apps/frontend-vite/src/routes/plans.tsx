import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { z } from 'zod'
import PlansRenderer from '@/components/PlansRenderer'
import { useCurrentUser } from '@/contexts/users'

const plansSearchSchema = z.object({
  selectedPlan: z.string().optional(),
})

export const Route = createFileRoute('/plans')({
  validateSearch: plansSearchSchema,
  component: PlansPage
})

function PlansPage() {
  const { user, isSignedIn } = useUser()
  const { currentUser } = useCurrentUser()
  const search = Route.useSearch()
  const { selectedPlan } = search

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to view your plans</p>
          <Link to="/signin" search={{ redirect_url: undefined }} className="text-blue-500 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {currentUser?.name ? `, ${currentUser.name}` : user?.fullName ? `, ${user.fullName}` : ""}. Here are your
        active plans:
      </h1>
      <PlansRenderer initialSelectedPlanId={selectedPlan} />
    </div>
  )
}