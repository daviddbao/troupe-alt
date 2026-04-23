"use client"

import { useState, useTransition } from "react"
import { addHotelStay, deleteHotelStay } from "@/lib/actions/trips"

type Hotel = {
  id: string
  userId: string
  displayName: string
  name: string
  address: string | null
  checkIn: string
  checkOut: string
  confirmationNumber: string | null
  notes: string | null
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function nightCount(checkIn: string, checkOut: string) {
  const diff = new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()
  return Math.round(diff / 86400000)
}

function HotelIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/><line x1="12" y1="12" x2="12" y2="12.01"/>
    </svg>
  )
}

export function HotelsSection({
  tripId,
  initialHotels,
  myUserId,
  isOrganizer,
}: {
  tripId: string
  initialHotels: Hotel[]
  myUserId: string
  isOrganizer: boolean
}) {
  const [hotels, setHotels] = useState<Hotel[]>(initialHotels)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [notes, setNotes] = useState("")

  function resetForm() {
    setName(""); setAddress(""); setCheckIn(""); setCheckOut("")
    setConfirmation(""); setNotes(""); setError(null)
  }

  function handleAdd() {
    setError(null)
    startT(async () => {
      const result = await addHotelStay(tripId, {
        name,
        address: address || undefined,
        checkIn,
        checkOut,
        confirmationNumber: confirmation || undefined,
        notes: notes || undefined,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        const optimistic: Hotel = {
          id: `tmp-${Date.now()}`,
          userId: myUserId,
          displayName: "You",
          name: name.trim(),
          address: address.trim() || null,
          checkIn,
          checkOut,
          confirmationNumber: confirmation.trim() || null,
          notes: notes.trim() || null,
        }
        setHotels((prev) => [...prev, optimistic].sort((a, b) => a.checkIn.localeCompare(b.checkIn)))
        setShowForm(false)
        resetForm()
      }
    })
  }

  function handleDelete(hotelId: string) {
    setHotels((prev) => prev.filter((h) => h.id !== hotelId))
    startT(async () => {
      const result = await deleteHotelStay(tripId, hotelId)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HotelIcon />
          <h2 className="text-sm font-semibold text-gray-700">Hotels</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-gray-500 hover:text-black transition-colors"
          >
            + Add hotel
          </button>
        )}
      </div>

      {hotels.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">Add your hotel so the group can see where everyone&apos;s staying.</p>
      )}

      {hotels.length > 0 && (
        <div className="space-y-1.5">
          {hotels.map((h) => {
            const isMe = h.userId === myUserId
            const nights = nightCount(h.checkIn, h.checkOut)
            return (
              <div key={h.id} className="flex items-start gap-2.5 group py-1">
                <HotelIcon className="mt-0.5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{h.name}</span>
                    <span className="text-xs text-gray-400">· {isMe ? "you" : h.displayName}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(h.checkIn)} → {formatDate(h.checkOut)} · {nights} night{nights !== 1 ? "s" : ""}
                  </p>
                  {h.address && <p className="text-xs text-gray-400 mt-0.5">{h.address}</p>}
                  {h.confirmationNumber && (
                    <p className="text-xs text-gray-400 mt-0.5">Conf: {h.confirmationNumber}</p>
                  )}
                  {h.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{h.notes}</p>}
                </div>
                {(isMe || isOrganizer) && (
                  <button
                    onClick={() => handleDelete(h.id)}
                    disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
                    aria-label="Delete hotel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700">Add a hotel</p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hotel name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marriott Cancun"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Address <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Blvd Kukulcan Km 14.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Check-out</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confirmation # <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="e.g. ABC123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. pool view room"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isPending || !name.trim() || !checkIn || !checkOut}
              className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Save hotel"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
