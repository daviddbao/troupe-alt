export default function DashboardLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-7 bg-gray-100 rounded w-28 mb-6" />
      <div className="h-11 bg-gray-100 rounded-xl mb-6" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
