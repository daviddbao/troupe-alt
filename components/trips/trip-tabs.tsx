"use client"

import { useState, type ReactNode } from "react"

type Tab = "plan" | "logistics" | "ideas"

export function TripTabs({
  planContent,
  logisticsContent,
  ideasContent,
  logisticsCount,
  ideasCount,
}: {
  planContent: ReactNode
  logisticsContent: ReactNode
  ideasContent: ReactNode
  logisticsCount: number
  ideasCount: number
}) {
  const [active, setActive] = useState<Tab>("plan")

  const tabs: { id: Tab; label: string; dot?: boolean }[] = [
    { id: "plan", label: "Plan" },
    { id: "logistics", label: "Logistics", dot: logisticsCount > 0 },
    { id: "ideas", label: "Ideas", dot: ideasCount > 0 },
  ]

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              active === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.dot && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active === tab.id ? "bg-gray-400" : "bg-gray-400"}`} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {active === "plan" && planContent}
        {active === "logistics" && logisticsContent}
        {active === "ideas" && ideasContent}
      </div>
    </div>
  )
}
