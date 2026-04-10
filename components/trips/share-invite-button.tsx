"use client"

import { useState } from "react"

export function ShareInviteButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle")

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my trip on Troupe", url })
        return
      } catch {
        // User cancelled or share unsupported — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    setState("copied")
    setTimeout(() => setState("idle"), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium hover:border-gray-400 hover:bg-gray-50 transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {state === "copied" ? "Link copied!" : "Share invite link"}
    </button>
  )
}
