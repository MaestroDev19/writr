import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-24 px-6 text-center">
      <div className="text-sm font-mono text-neutral-400">404</div>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Page Not Found</h1>
      <p className="mt-2 text-sm text-neutral-500">
        The route you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex rounded-full bg-neutral-900 px-5 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
