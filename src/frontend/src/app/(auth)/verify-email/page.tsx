'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Input } from '@/app/components/ui';
import { useToastStore } from '@/app/hooks/useToastStore';

function VerifyEmailInner(): React.ReactElement {
  const searchParams = useSearchParams();
  const { addToast } = useToastStore();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function resend(): Promise<void> {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 400) {
        addToast({ variant: 'error', message: 'Enter a valid email address.' });
        return;
      }
      addToast({
        variant: 'success',
        message: 'If that account still needs verifying, we just sent a new link.',
      });
    } catch {
      addToast({ variant: 'error', message: 'Could not send the email. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-xl">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="text-sm text-muted">
        We sent a verification link to your inbox. Click it to activate your account,
        then sign in. Didn&apos;t get it? Request a new one below.
      </p>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button
        type="button"
        variant="primary"
        loading={submitting}
        onClick={resend}
        className="w-full"
      >
        Resend verification email
      </Button>
      <Link href="/login" className="text-center text-sm text-blue-500 hover:underline">
        Back to sign-in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
