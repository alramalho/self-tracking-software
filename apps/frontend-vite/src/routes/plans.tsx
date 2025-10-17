import PlansRenderer from '@/components/PlansRenderer'
import { useUser } from '@/contexts/auth'
import { useCurrentUser } from '@/contexts/users'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

const plansSearchSchema = z.object({
  selectedPlan: z.string().optional(),
})

export const Route = createFileRoute('/plans')({
  validateSearch: plansSearchSchema,
  component: PlansPage
})

function PlansPage() {
  const { isSignedIn } = useUser()
  const { currentUser } = useCurrentUser()
  const search = Route.useSearch()
  const { selectedPlan } = search

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your plans</p>
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
        Welcome{" "}
        {currentUser?.name || ""}! Here are your
        active plans:
      </h1>
      <PlansRenderer initialSelectedPlanId={selectedPlan} />
    </div>
  )
}