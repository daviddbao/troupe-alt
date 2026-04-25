"use client"

import { useState, useTransition } from "react"
import { addExpense, deleteExpense } from "@/lib/actions/trips"

type Expense = {
  id: string
  paidBy: string
  payerName: string
  amount: number
  description: string
  createdAt: Date | null
}

type Member = { userId: string; displayName: string }

function formatAmount(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function parseAmount(s: string): number | null {
  const n = parseFloat(s.replace(/[$,]/g, ""))
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

function calculateBalances(expenses: Expense[], members: Member[], myUserId: string) {
  if (members.length === 0 || expenses.length === 0) return []
  const balances: Record<string, number> = {}
  for (const m of members) balances[m.userId] = 0

  for (const exp of expenses) {
    const share = exp.amount / members.length
    if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] += exp.amount - share
    for (const m of members) {
      if (m.userId !== exp.paidBy && balances[m.userId] !== undefined) {
        balances[m.userId] -= share
      }
    }
  }

  return members
    .filter((m) => Math.abs(balances[m.userId] ?? 0) >= 1)
    .map((m) => ({ userId: m.userId, displayName: m.displayName, balance: balances[m.userId] ?? 0 }))
    .sort((a, b) => b.balance - a.balance)
}

export function ExpensesSection({
  tripId,
  initialExpenses,
  myUserId,
  isOrganizer,
  members,
}: {
  tripId: string
  initialExpenses: Expense[]
  myUserId: string
  isOrganizer: boolean
  members: Member[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [description, setDescription] = useState("")
  const [amountStr, setAmountStr] = useState("")
  const [paidBy, setPaidBy] = useState(myUserId)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const balances = calculateBalances(expenses, members, myUserId)
  const myBalance = balances.find((b) => b.userId === myUserId)

  function handleAdd() {
    const cents = parseAmount(amountStr)
    if (!cents) return setError("Enter a valid amount.")
    if (!description.trim()) return setError("Description is required.")
    setError(null)

    const payer = members.find((m) => m.userId === paidBy)
    const optimistic: Expense = {
      id: `tmp-${Date.now()}`,
      paidBy,
      payerName: paidBy === myUserId ? "You" : (payer?.displayName ?? ""),
      amount: cents,
      description: description.trim(),
      createdAt: new Date(),
    }
    setExpenses((prev) => [optimistic, ...prev])
    setDescription("")
    setAmountStr("")
    setPaidBy(myUserId)
    setShowAdd(false)

    startT(async () => {
      const result = await addExpense(tripId, paidBy, cents, description.trim())
      if (result?.error) {
        setExpenses((prev) => prev.filter((e) => e.id !== optimistic.id))
        setError(result.error)
      } else if (result?.id) {
        setExpenses((prev) => prev.map((e) => e.id === optimistic.id ? { ...e, id: result.id! } : e))
      }
    })
  }

  function handleDelete(expenseId: string) {
    const removed = expenses.find((e) => e.id === expenseId)
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
    startT(async () => {
      const result = await deleteExpense(tripId, expenseId)
      if (result?.error) {
        setError(result.error)
        if (removed) setExpenses((prev) => [removed, ...prev])
      }
    })
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Expenses</h2>
          {expenses.length > 0 && (
            <span className="text-xs text-gray-400">{formatAmount(total)} total</span>
          )}
        </div>
        {myBalance && (
          <span className={`text-xs font-medium ${myBalance.balance > 0 ? "text-green-600" : "text-red-500"}`}>
            {myBalance.balance > 0 ? `You're owed ${formatAmount(myBalance.balance)}` : `You owe ${formatAmount(-myBalance.balance)}`}
          </span>
        )}
      </div>

      {expenses.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400">Track who paid for what and settle up after the trip.</p>
      )}

      {expenses.length > 0 && (
        <ul className="space-y-1.5">
          {expenses.map((exp) => (
            <li key={exp.id} className="flex items-center gap-2.5 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{exp.description}</p>
                <p className="text-xs text-gray-400">
                  {exp.paidBy === myUserId ? "You" : exp.payerName} paid · split {members.length} ways
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700 flex-shrink-0">{formatAmount(exp.amount)}</span>
              {(exp.paidBy === myUserId || isOrganizer) && (
                <button
                  onClick={() => handleDelete(exp.id)}
                  disabled={isPending}
                  className="text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0"
                  aria-label="Delete expense"
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

      {/* Settlement summary */}
      {balances.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-1">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Settle up</p>
          {balances.map((b) => (
            <p key={b.userId} className="text-xs text-gray-600">
              {b.userId === myUserId ? "You" : b.displayName}
              {b.balance > 0 ? (
                <span className="text-green-600"> are owed {formatAmount(b.balance)}</span>
              ) : (
                <span className="text-red-500"> owe {formatAmount(-b.balance)}</span>
              )}
            </p>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {showAdd ? (
        <div className="space-y-2 pt-1">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it for?"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <div className="flex gap-2">
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
              placeholder="$0.00"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            {members.length > 1 && (
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === myUserId ? "You" : m.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setError(null) }}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isPending || !description.trim() || !amountStr.trim()}
              className="flex-1 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + Add expense
        </button>
      )}
    </div>
  )
}
