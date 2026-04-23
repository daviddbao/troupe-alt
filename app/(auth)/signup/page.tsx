import { SignupForm } from "@/components/auth/signup-form"
import Link from "next/link"

type Props = { searchParams: Promise<{ callbackUrl?: string }> }

export default async function SignupPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <p className="text-sm text-gray-500 mt-1">Plan trips with your people</p>
        </div>
        <SignupForm callbackUrl={callbackUrl ?? "/dashboard"} />
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link
            href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
            className="text-black font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
