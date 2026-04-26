"use client"

import { useState, useTransition } from "react"
import { createInvite } from "@/lib/actions/trips"
import { ShareInviteButton } from "./share-invite-button"
import { Chevron } from "@/components/ui/collapsible-card"

export function InviteSection({
  tripId,
  existingCode,
  baseUrl,
}: {
  tripId: string
  existingCode: string | null
  baseUrl: string
}) {
  const [code, setCode] = useState<string | null>(existingCode)
  const [sectionOpen, setSectionOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await createInvite(tripId)
      if (result?.error) { setError(result.error); return }
      if (result?.code) setCode(result.code)
    })
  }

  const inviteUrl = code ? `${baseUrl}/invite/${code}` : null

  return (
    <div className="border border-gray-200 rounded-xl">
      <button
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">Invite friends</span>
        <Chevron open={sectionOpen} />
      </button>
      {sectionOpen && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-400">Share this link — anyone with it can join the trip.</p>
          {inviteUrl ? (
            <ShareInviteButton url={inviteUrl} />
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              {isPending ? "Generating…" : "Generate invite link"}
            </button>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
