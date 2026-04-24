"use client"

import { useState, useTransition } from "react"
import { addMemberFlight, deleteMemberFlight } from "@/lib/actions/trips"

type Flight = {
  id: string
  userId: string
  displayName: string
  direction: string
  flightNumber: string
  departureAirport: string | null
  arrivalAirport: string | null
  departureAt: string
  arrivalAt: string
  notes: string | null
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.7.7-.4 1l2.9 2.9L2.9 12c-.3.3-.1.9.4 1l3.8 1.1 1.1 3.8c.1.5.6.7 1 .4l1.8-1.3 2.9 2.9c.3.3.9.1 1-.4z"/>
    </svg>
  )
}

export function FlightsSection({
  tripId,
  initialFlights,
  myUserId,
  isOrganizer,
}: {
  tripId: string
  initialFlights: Flight[]
  myUserId: string
  isOrganizer: boolean
}) {
  const [flights, setFlights] = useState<Flight[]>(initialFlights)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [direction, setDirection] = useState<"outbound" | "return">("outbound")
  const [flightNumber, setFlightNumber] = useState("")
  const [departureAirport, setDepartureAirport] = useState("")
  const [arrivalAirport, setArrivalAirport] = useState("")
  const [departureAt, setDepartureAt] = useState("")
  const [arrivalAt, setArrivalAt] = useState("")
  const [notes, setNotes] = useState("")

  function resetForm() {
    setDirection("outbound")
    setFlightNumber("")
    setDepartureAirport("")
    setArrivalAirport("")
    setDepartureAt("")
    setArrivalAt("")
    setNotes("")
    setError(null)
  }

  function handleAdd() {
    setError(null)
    startT(async () => {
      const result = await addMemberFlight(tripId, {
        direction,
        flightNumber,
        departureAirport: departureAirport || undefined,
        arrivalAirport: arrivalAirport || undefined,
        departureAt,
        arrivalAt,
        notes: notes || undefined,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        // Optimistic: just refetch by adding a placeholder that looks right
        const optimistic: Flight = {
          id: `tmp-${Date.now()}`,
          userId: myUserId,
          displayName: "You",
          direction,
          flightNumber: flightNumber.trim().toUpperCase(),
          departureAirport: departureAirport.trim().toUpperCase() || null,
          arrivalAirport: arrivalAirport.trim().toUpperCase() || null,
          departureAt,
          arrivalAt,
          notes: notes.trim() || null,
        }
        setFlights((prev) => [...prev, optimistic].sort((a, b) => a.departureAt.localeCompare(b.departureAt)))
        setShowForm(false)
        resetForm()
      }
    })
  }

  function handleDelete(flightId: string) {
    const removed = flights.find((f) => f.id === flightId)
    setFlights((prev) => prev.filter((f) => f.id !== flightId))
    startT(async () => {
      const result = await deleteMemberFlight(tripId, flightId)
      if (result?.error) {
        setError(result.error)
        if (removed) setFlights((prev) => [...prev, removed].sort((a, b) => a.departureAt.localeCompare(b.departureAt)))
      }
    })
  }

  const outbound = flights.filter((f) => f.direction === "outbound")
  const returning = flights.filter((f) => f.direction === "return")
  const myFlights = flights.filter((f) => f.userId === myUserId)

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlaneIcon />
          <h2 className="text-sm font-semibold text-gray-700">Flights</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-gray-500 hover:text-black transition-colors"
          >
            + Add flight
          </button>
        )}
      </div>

      {flights.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">Add your flight details so the group can coordinate arrivals.</p>
      )}

      {/* Outbound flights */}
      {outbound.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Outbound</p>
          {outbound.map((f) => (
            <FlightRow
              key={f.id}
              flight={f}
              myUserId={myUserId}
              isOrganizer={isOrganizer}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Return flights */}
      {returning.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Return</p>
          {returning.map((f) => (
            <FlightRow
              key={f.id}
              flight={f}
              myUserId={myUserId}
              isOrganizer={isOrganizer}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Add flight form */}
      {showForm && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700">Add a flight</p>

          {/* Direction toggle */}
          <div className="flex gap-2">
            {(["outbound", "return"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  direction === d ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {d === "outbound" ? "Outbound" : "Return"}
              </button>
            ))}
          </div>

          {/* Flight number */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flight number</label>
            <input
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="e.g. AA 1234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              autoFocus
            />
          </div>

          {/* Airports */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
              <input
                value={departureAirport}
                onChange={(e) => setDepartureAirport(e.target.value)}
                placeholder="LAX"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
              <input
                value={arrivalAirport}
                onChange={(e) => setArrivalAirport(e.target.value)}
                placeholder="CUN"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Departs</label>
              <input
                type="datetime-local"
                value={departureAt}
                onChange={(e) => setDepartureAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Arrives</label>
              <input
                type="datetime-local"
                value={arrivalAt}
                onChange={(e) => setArrivalAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. connecting via Dallas"
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
              disabled={isPending || !flightNumber.trim() || !departureAt || !arrivalAt}
              className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Save flight"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FlightRow({
  flight,
  myUserId,
  isOrganizer,
  onDelete,
  isPending,
}: {
  flight: Flight
  myUserId: string
  isOrganizer: boolean
  onDelete: (id: string) => void
  isPending: boolean
}) {
  const route = [flight.departureAirport, flight.arrivalAirport].filter(Boolean).join(" → ")
  const isMe = flight.userId === myUserId

  return (
    <div className="flex items-start gap-2.5 group py-1">
      <PlaneIcon className="mt-0.5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{flight.flightNumber}</span>
          {route && <span className="text-xs text-gray-500">{route}</span>}
          <span className="text-xs text-gray-400">· {isMe ? "you" : flight.displayName}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatDateTime(flight.departureAt)} → {formatDateTime(flight.arrivalAt)}
        </p>
        {flight.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{flight.notes}</p>}
      </div>
      {(isMe || isOrganizer) && (
        <button
          onClick={() => onDelete(flight.id)}
          disabled={isPending}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
          aria-label="Delete flight"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}
