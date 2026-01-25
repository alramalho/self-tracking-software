import PlansRenderer from '@/components/PlansRenderer'
import { Button } from '@/components/ui/button'
import { useUser } from '@/contexts/auth'
import { useCurrentUser } from '@/contexts/users'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'

const plansSearchSchema = z.object({
  selectedPlan: z.string().optional(),
  scrollTo: z.string().optional(),
})

export const Route = createFileRoute('/plans')({
  validateSearch: plansSearchSchema,
  component: PlansPage
})

function PlansPage() {
  const { isSignedIn } = useUser()
  const { currentUser } = useCurrentUser()
  const search = Route.useSearch()
  const { selectedPlan, scrollTo } = search

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
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">
          Plans
        </h1>
      </div>
      <PlansRenderer initialSelectedPlanId={selectedPlan} scrollTo={scrollTo} />
    </div>
  )
}