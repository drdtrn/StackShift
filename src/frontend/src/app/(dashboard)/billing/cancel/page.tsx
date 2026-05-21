import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-6">
      <h1 className="text-3xl font-bold">No charge made.</h1>
      <p className="text-muted max-w-md">
        You cancelled before completing checkout. Come back any time.
      </p>
      <Link
        href="/settings/billing"
        className="text-sm underline text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        Back to billing →
      </Link>
    </div>
  );
}
