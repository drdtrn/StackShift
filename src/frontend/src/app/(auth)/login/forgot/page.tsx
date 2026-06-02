import Link from 'next/link';

export const metadata = {
  title: 'Forgot password — StackSift',
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-xl">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="text-sm text-muted">
        We&apos;ll take you to our secure sign-in page to reset your password.
        Enter your email there and we&apos;ll send you a link to choose a new one.
      </p>
      <a
        href="/api/auth/forgot"
        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
      >
        Reset my password
      </a>
      <Link href="/login" className="text-center text-sm text-blue-500 hover:underline">
        Back to sign-in
      </Link>
    </div>
  );
}
