import { LoginForm } from "@/components/auth/login-form"
import Link from "next/link"

type Props = { searchParams: Promise<{ callbackUrl?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your Troupe account</p>
        </div>
        <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-black font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
