import Link from 'next/link';

export const metadata = {
  title: 'Page Not Found | StackSift',
};

/**
 * Custom 404 page.
 *
 * Rendered whenever Next.js cannot match a URL to any route segment.
 * This is a Server Component — no interactivity needed.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4">
      <p className="text-6xl font-bold text-zinc-300 dark:text-zinc-600">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-zinc-500 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
