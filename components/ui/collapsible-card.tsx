"use client"

import { useState, type ReactNode } from "react"

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width="14" height="14"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`flex-shrink-0 transition-transform duration-200 text-gray-400 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function CollapsibleCard({
  title,
  badge,
  defaultOpen = true,
  children,
  contentClass = "space-y-3",
}: {
  title: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  contentClass?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-200 rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {typeof title === "string"
            ? <span className="text-sm font-semibold text-gray-700">{title}</span>
            : title}
          {badge && <span className="ml-auto mr-2">{badge}</span>}
        </div>
        <Chevron open={open} />
      </button>
      {open && <div className={`px-4 pb-4 ${contentClass}`}>{children}</div>}
    </div>
  )
}
