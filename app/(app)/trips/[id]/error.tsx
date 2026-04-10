"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function TripError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Couldn&apos;t load this trip</h1>
      <p className="text-sm text-gray-500">Something went wrong. Try refreshing or go back to your trips.</p>
      <div className="flex gap-3 justify-center mt-2">
        <button
          onClick={reset}
          className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          My trips
        </Link>
      </div>
    </div>
  )
}
