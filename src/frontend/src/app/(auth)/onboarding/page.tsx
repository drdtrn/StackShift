'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from '@/app/hooks/useSession';
import { useCreateOrganisation } from '@/app/hooks/useCreateOrganisation';
import { createOrganisationSchema, type CreateOrganisationInput } from '@/app/lib/schemas/organisation';
import { Input } from '@/app/components/ui/Input';
import { Button } from '@/app/components/ui/Button';
import { Spinner } from '@/app/components/ui/Spinner';

// ---------------------------------------------------------------------------
// /onboarding — Create Organisation
//
// Shown to users who are authenticated but have no organisation (organizationId
// is null). The (auth) route group applies the centred, sidebar-free layout.
//
// Guard logic (this page guards itself):
//   - Loading: show Spinner (session check in flight)
//   - Not authenticated: redirect to /login
//   - Already has org: redirect to / (shouldn't land here after onboarding)
//   - Authenticated + no org: show the form ✓
//
// Why does the page guard itself instead of relying solely on OrgGuard?
//   The dashboard's OrgGuard redirects org-less users TO this page.
//   But this page also needs to redirect users AWAY if they somehow arrive
//   here already having an org (e.g. browser back button, direct URL entry).
//   The two guards are complementary, not redundant.
//
// Form:
//   - React Hook Form with zodResolver (first use of RHF in this project)
//   - Single field: name (2–50 chars, alphanumeric/spaces/hyphens)
//   - Inline validation errors from RHF's formState.errors
//   - Submit disabled until isValid AND not isPending
//   - Loading spinner on button while mutation is in flight
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const { createOrganisation, isPending } = useCreateOrganisation();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateOrganisationInput>({
    resolver: zodResolver(createOrganisationSchema),
    mode: 'onChange', // validate on every keystroke for live feedback
  });

  // Redirect logic:
  //   - Not authenticated → /login
  //   - Already has an org → / (already onboarded, shouldn't be here)
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.organizationId !== null) {
        router.replace('/');
      }
    }
  }, [isLoading, user, router]);

  // Show a full-page spinner while the session check is in flight.
  if (isLoading) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        aria-busy="true"
        aria-label="Loading…"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  // Guard redirects are in progress. Return null to avoid flash of content.
  if (!user || user.organizationId !== null) {
    return null;
  }

  function onSubmit(data: CreateOrganisationInput) {
    createOrganisation(data);
  }

  return (
    <div className="flex flex-col gap-8 rounded-xl border border-line bg-surface p-8 shadow-xl">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-primary">
              Create your organisation
            </h1>
            <p className="text-sm text-muted">
              Welcome to StackSift, {user.displayName.split(' ')[0]}!
            </p>
          </div>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          An organisation groups all your projects, logs, and team members in
          one workspace. You can rename it later in Settings.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <Input
          label="Organisation name"
          placeholder="e.g. Acme Corp"
          helperText="2–50 characters. Letters, numbers, spaces, and hyphens."
          errorMessage={errors.name?.message}
          autoFocus
          autoComplete="organization"
          aria-required="true"
          {...register('name')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!isValid || isPending}
          loading={isPending}
        >
          {isPending ? 'Creating…' : 'Create organisation'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted">
        You can add team members and projects after setting up your organisation.
      </p>
    </div>
  );
}
