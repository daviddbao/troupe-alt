import { joinTripByCode } from "@/lib/actions/trips"

type Props = { params: Promise<{ code: string }> }

export default async function InvitePage({ params }: Props) {
  const { code } = await params
  await joinTripByCode(code)
  // joinTripByCode redirects on success or unauthenticated
  // Only reaches here on error
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Invalid invite</h1>
        <p className="text-sm text-gray-500">This invite link is no longer valid.</p>
      </div>
    </div>
  )
}
