export default function TripLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-gray-100 rounded" />
        <div className="h-7 bg-gray-100 rounded w-40" />
      </div>

      {/* Group availability card */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-36" />
        <div className="h-64 bg-gray-100 rounded-xl" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 bg-gray-100 rounded w-16" />
          ))}
        </div>
      </div>

      {/* Members card */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-16" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-100 rounded-full" />
            <div className="h-4 bg-gray-100 rounded w-28" />
          </div>
        ))}
      </div>

      {/* My availability card */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-28" />
        <div className="h-10 bg-gray-100 rounded-lg" />
      </div>

      {/* Preferences card */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-24" />
        <div className="h-10 bg-gray-100 rounded-lg" />
      </div>
    </div>
  )
}
