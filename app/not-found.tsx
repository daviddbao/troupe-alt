import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-5xl font-bold text-gray-200">404</p>
        <h1 className="text-lg font-semibold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500">This page doesn&apos;t exist or you don&apos;t have access.</p>
        <Link
          href="/dashboard"
          className="inline-block mt-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
