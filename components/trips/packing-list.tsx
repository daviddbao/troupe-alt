"use client"

import { useState, useTransition } from "react"
import { addPackingItem, deletePackingItem, togglePackingCheck } from "@/lib/actions/trips"
import { Chevron } from "@/components/ui/collapsible-card"

type PackingItem = {
  id: string
  label: string
  createdBy: string
  creatorName: string
  packedByIds: string[]
  iPackedIt: boolean
}

type Member = { userId: string; displayName: string }

export function PackingList({
  tripId,
  initialItems,
  myUserId,
  isOrganizer,
  members,
}: {
  tripId: string
  initialItems: PackingItem[]
  myUserId: string
  isOrganizer: boolean
  members: Member[]
}) {
  const [items, setItems] = useState<PackingItem[]>(initialItems)
  const [sectionOpen, setSectionOpen] = useState(true)
  const [draft, setDraft] = useState("")
  const [isPending, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const SUGGESTIONS = ["Passport", "Charging cable", "Travel adapter", "Portable charger", "Toothbrush", "Toothpaste", "Skincare", "Glasses/contacts", "Pen", "Hat", "Headphones"]

  function handleAddLabel(label: string) {
    const trimmed = label.trim()
    if (!trimmed) return
    setError(null)
    const optimistic: PackingItem = {
      id: `tmp-${Date.now()}`,
      label: trimmed,
      createdBy: myUserId,
      creatorName: "You",
      packedByIds: [],
      iPackedIt: false,
    }
    setItems((prev) => [...prev, optimistic])
    setDraft("")
    startT(async () => {
      const result = await addPackingItem(tripId, trimmed)
      if (result?.error) {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        setError(result.error)
      } else if (result?.id) {
        setItems((prev) => prev.map((i) => i.id === optimistic.id ? { ...i, id: result.id! } : i))
      }
    })
  }

  function handleAdd() { handleAddLabel(draft) }

  function handleDelete(itemId: string) {
    const removed = items.find((i) => i.id === itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    startT(async () => {
      const result = await deletePackingItem(tripId, itemId)
      if (result?.error) {
        setError(result.error)
        if (removed) setItems((prev) => [...prev, removed])
      }
    })
  }

  function handleToggle(itemId: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const nowPacked = !item.iPackedIt
        return {
          ...item,
          iPackedIt: nowPacked,
          packedByIds: nowPacked
            ? [...item.packedByIds, myUserId]
            : item.packedByIds.filter((id) => id !== myUserId),
        }
      })
    )
    startT(async () => {
      await togglePackingCheck(tripId, itemId)
    })
  }

  const packedCount = items.filter((i) => i.iPackedIt).length

  return (
    <div className="border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setSectionOpen((v) => !v)} className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Packing list</span>
          <Chevron open={sectionOpen} />
        </button>
        {sectionOpen && items.length > 0 && (
          <span className="text-xs text-gray-400">{packedCount}/{items.length} packed</span>
        )}
      </div>

      {sectionOpen && <div className="px-4 pb-4 space-y-3">

      {items.length === 0 && (
        <p className="text-sm text-gray-400">
          Add items the group should remember to bring.
        </p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const packedNames = item.packedByIds
              .filter((id) => id !== myUserId)
              .map((id) => members.find((m) => m.userId === id)?.displayName)
              .filter(Boolean)

            return (
              <li key={item.id} className="flex items-center gap-2.5 group">
                <button
                  onClick={() => handleToggle(item.id)}
                  disabled={isPending}
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    item.iPackedIt
                      ? "bg-black border-black"
                      : "border-gray-300 hover:border-gray-500"
                  }`}
                  aria-label={item.iPackedIt ? "Unmark as packed" : "Mark as packed"}
                >
                  {item.iPackedIt && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>

                <span className={`flex-1 text-sm ${item.iPackedIt ? "line-through text-gray-400" : "text-gray-800"}`}>
                  {item.label}
                </span>

                {packedNames.length > 0 && (
                  <span className="text-xs text-gray-400 hidden sm:block">
                    also: {packedNames.join(", ")}
                  </span>
                )}

                {(item.createdBy === myUserId || isOrganizer) && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                    aria-label="Delete item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Quick-add suggestion chips — hide already-added items */}
      {(() => {
        const existing = new Set(items.map((i) => i.label.toLowerCase()))
        const available = SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()))
        if (available.length === 0) return null
        return (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {available.map((s) => (
              <button
                key={s}
                onClick={() => handleAddLabel(s)}
                disabled={isPending}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-full text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
              >
                + {s}
              </button>
            ))}
          </div>
        )
      })()}

      <div className="flex gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="Add an item…"
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

      </div>}
    </div>
  )
}
