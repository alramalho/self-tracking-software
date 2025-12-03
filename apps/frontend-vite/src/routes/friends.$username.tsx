import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useUnifiedProfileData } from '@/hooks/useUnifiedProfileData'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useMemo } from 'react'
import UserSearch, { type UserSearchResult } from '@/components/UserSearch'

export const Route = createFileRoute('/friends/$username')({
  component: FriendsPage,
})

function FriendsPage() {
  const { username } = Route.useParams()
  const { profileData, isLoading, isOwnProfile } = useUnifiedProfileData(username)
  const navigate = useNavigate()

  const handleUserClick = (user: UserSearchResult) => {
    navigate({ to: '/profile/$username', params: { username: user.username } })
  }

  const friends = useMemo(
    () => [
      ...(profileData?.connectionsFrom
        .filter((conn) => conn.status === 'ACCEPTED')
        ?.map((conn) => conn.to) || []),
      ...(profileData?.connectionsTo
        .filter((conn) => conn.status === 'ACCEPTED')
        ?.map((conn) => conn.from) || []),
    ],
    [profileData?.connectionsFrom, profileData?.connectionsTo]
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between relative mb-4">
        <button
          className="absolute left-0 p-2 rounded-full hover:bg-gray-100"
          onClick={() => window.history.back()}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold mx-auto">Friends</h1>
      </div>

      {isOwnProfile && (
        <div className="mb-6">
          <UserSearch onUserClick={handleUserClick} />
        </div>
      )}

      {friends?.length && friends?.length > 0 ? (
        <ul className="space-y-4">
          {friends?.map((friend) => (
            <li key={friend.username} className="border-b pb-4">
              <Link
                to={`/profile/$username`} params={{ username: friend.username || "" }}
                className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg"
              >
                <Avatar>
                  <AvatarImage
                    src={friend.picture || ''}
                    alt={friend.name || ''}
                  />
                  <AvatarFallback>{(friend.name || 'U')?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{friend.name}</p>
                  <p className="text-sm text-gray-500">@{friend.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : isLoading ? (
        <ul className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={`skeleton-${index}`} className="border-b pb-4">
              <div className="flex items-center space-x-4 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-500">
          {isOwnProfile ? "You don't have any friends yet." : "No friends yet."}
        </p>
      )}
    </div>
  )
}
