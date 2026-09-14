import { Link } from "react-router-dom"

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl py-12 px-6">
      <div className="space-y-4">
        <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium tracking-wide uppercase dark:bg-neutral-800">
          Cohere Platform
        </span>
        <h1 className="text-4xl font-normal tracking-tight sm:text-5xl">
          Enterprise AI Platform
        </h1>
        <p className="max-w-2xl text-base text-neutral-600 dark:text-neutral-400">
          Welcome to the application. All core routes have been configured below.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/login"
          className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
        >
          <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Auth
          </div>
          <h2 className="mt-2 text-lg font-medium group-hover:underline">
            Login &rarr;
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Work email & password sign in route
          </p>
        </Link>

        <Link
          to="/signup"
          className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
        >
          <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Auth
          </div>
          <h2 className="mt-2 text-lg font-medium group-hover:underline">
            Signup &rarr;
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Create a new workspace account route
          </p>
        </Link>

        <Link
          to="/forgot-password"
          className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
        >
          <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Auth
          </div>
          <h2 className="mt-2 text-lg font-medium group-hover:underline">
            Forgot Password &rarr;
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Password reset request route
          </p>
        </Link>

        <Link
          to="/dashboard"
          className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
        >
          <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Dummy Page
          </div>
          <h2 className="mt-2 text-lg font-medium group-hover:underline">
            Dashboard &rarr;
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Enterprise console dummy page
          </p>
        </Link>

        <Link
          to="/playground"
          className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
        >
          <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Dummy Page
          </div>
          <h2 className="mt-2 text-lg font-medium group-hover:underline">
            Playground &rarr;
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Prompt test studio dummy page
          </p>
        </Link>
      </div>
    </div>
  )
}
