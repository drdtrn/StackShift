import Link from 'next/link';

export const metadata = {
  title: 'Forgot password — StackSift',
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-xl">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="text-sm text-muted">
        Password reset isn&apos;t available yet. For now, contact the owner of
        your organisation or email support@stacksift.io for help.
      </p>
      <Link href="/login" className="text-sm text-blue-500 hover:underline">
        Back to sign-in
      </Link>
    </div>
  );
}
