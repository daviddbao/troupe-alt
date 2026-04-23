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

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "plan", label: "Plan" },
    { id: "logistics", label: "Logistics", count: logisticsCount || undefined },
    { id: "ideas", label: "Ideas", count: ideasCount || undefined },
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
            {tab.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                active === tab.id ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"
              }`}>
                {tab.count}
              </span>
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
