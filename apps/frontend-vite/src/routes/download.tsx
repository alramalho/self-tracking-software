import { createFileRoute } from '@tanstack/react-router'
import DownloadComponent from '../components/DownloadComponent'

export const Route = createFileRoute('/download')({
  component: DownloadPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      instagram: search.instagram === 'true',
      tiktok: search.tiktok === 'true',
    }
  },
})

function DownloadPage() {
  const { instagram, tiktok } = Route.useSearch()

  return (
    <div className="h-full w-full absolute flex z-[10] flex-col items-center justify-center px-4 bg-white overflow-hidden pointer-events-auto z-[1000]">
      <DownloadComponent isInstagram={instagram} isTikTok={tiktok} />
    </div>
  )
}