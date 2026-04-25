"use client"

import { useState, useTransition, useRef } from "react"
import { addTripIdea, deleteTripIdea, toggleIdeaVote } from "@/lib/actions/trips"

type Idea = {
  id: string
  text: string
  createdBy: string
  creatorName: string
  createdAt: Date | null
  voteCount: number
  iVoted: boolean
}

export function IdeasBoard({
  tripId,
  initialIdeas,
  myUserId,
  isOrganizer,
}: {
  tripId: string
  initialIdeas: Idea[]
  myUserId: string
  isOrganizer: boolean
}) {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas)
  const [draft, setDraft] = useState("")
  const [isPending, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const text = draft.trim()
    if (!text) return
    setError(null)
    const optimistic: Idea = {
      id: `tmp-${Date.now()}`,
      text,
      createdBy: myUserId,
      creatorName: "You",
      createdAt: new Date(),
      voteCount: 0,
      iVoted: false,
    }
    setIdeas((prev) => [...prev, optimistic])
    setDraft("")
    startT(async () => {
      const result = await addTripIdea(tripId, text)
      if (result?.error) {
        setIdeas((prev) => prev.filter((i) => i.id !== optimistic.id))
        setError(result.error)
      }
    })
  }

  function handleDelete(ideaId: string) {
    const removed = ideas.find((i) => i.id === ideaId)
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId))
    startT(async () => {
      const result = await deleteTripIdea(tripId, ideaId)
      if (result?.error) {
        setError(result.error)
        if (removed) setIdeas((prev) => [...prev, removed])
      }
    })
  }

  function handleVote(ideaId: string) {
    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id !== ideaId) return i
        return { ...i, iVoted: !i.iVoted, voteCount: i.iVoted ? i.voteCount - 1 : i.voteCount + 1 }
      }).sort((a, b) => b.voteCount - a.voteCount || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    )
    startT(async () => {
      const result = await toggleIdeaVote(tripId, ideaId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Ideas</h2>

      {ideas.length === 0 && (
        <p className="text-sm text-gray-400">
          Throw in restaurants, hikes, activities — anything the group might want to do.
        </p>
      )}

      {ideas.length > 0 && (
        <ul className="space-y-1.5">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex items-center gap-2.5 group">
              {/* Vote button */}
              <button
                onClick={() => handleVote(idea.id)}
                disabled={isPending || idea.id.startsWith("tmp-")}
                className={`flex flex-col items-center flex-shrink-0 w-8 py-0.5 rounded-md border transition-all disabled:opacity-40 ${
                  idea.iVoted
                    ? "border-black bg-black text-white"
                    : "border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                }`}
                aria-label={idea.iVoted ? "Remove vote" : "Upvote"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 15l-6-6-6 6"/>
                </svg>
                <span className="text-xs font-medium leading-tight">{idea.voteCount}</span>
              </button>

              <span className="flex-1 text-sm text-gray-800">{idea.text}</span>

              <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                {idea.createdBy === myUserId ? "you" : idea.creatorName}
              </span>

              {(idea.createdBy === myUserId || isOrganizer) && (
                <button
                  onClick={() => handleDelete(idea.id)}
                  disabled={isPending}
                  className="text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0"
                  aria-label="Delete idea"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="Add an idea…"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !draft.trim()}
          className="px-3 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
