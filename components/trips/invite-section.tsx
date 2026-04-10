"use client"

import { useState, useTransition } from "react"
import { createInvite } from "@/lib/actions/trips"
import { ShareInviteButton } from "./share-invite-button"

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
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      const result = await createInvite(tripId)
      if (result.code) setCode(result.code)
    })
  }

  const inviteUrl = code ? `${baseUrl}/invite/${code}` : null

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Invite friends</h2>
      <p className="text-xs text-gray-400 mb-3">Share this link — anyone with it can join the trip.</p>
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
    </div>
  )
}
