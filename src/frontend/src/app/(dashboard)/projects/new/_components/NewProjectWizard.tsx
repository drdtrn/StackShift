'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { projectFormSchema, type ProjectFormInput } from '@/app/lib/schemas/project';
import { FormStepperProvider } from '@/app/components/forms/FormStepperContext';
import { FormStepper } from '@/app/components/forms/FormStepper';
import { ProjectBasicInfoStep } from './ProjectBasicInfoStep';
import { ProjectLogSourceStep } from './ProjectLogSourceStep';
import { ProjectReviewStep } from './ProjectReviewStep';
import { useCreateProject } from '@/app/hooks/mutations/use-create-project';

// ---------------------------------------------------------------------------
// NewProjectWizard — 3-step form orchestrator
//
// Architecture: ONE useForm instance for the entire wizard.
//
// WHY one form, not three separate forms?
//   If each step had its own useForm, you would need to manually merge the
//   three result objects before submitting. With one form, all values live in
//   a single controlled object from the start. RHF's register() can target
//   any field at any time — the wizard just controls WHICH fields are visible.
//
// Per-step validation — form.trigger(fieldPaths):
//   Calling trigger(['name', 'description']) validates ONLY those two fields
//   and returns Promise<boolean>. If it returns false, RHF has already set
//   errors for those fields — the UI shows them and we stay on the current
//   step. Only when trigger returns true do we advance. This is the standard
//   multi-step RHF pattern: full schema validation at submit, partial trigger
//   at each step boundary.
//
// Step field map — what trigger() validates per step:
//   Step 0: ['name', 'description']
//   Step 1: ['logSourceConfig']      ← validates the whole discriminated union
//   Step 2: (last step → submit)
//
// Default values for the discriminated union:
//   We must initialise logSourceConfig with a concrete type so Zod always has
//   a valid discriminant to start with. We pick 'Application' as the default.
//   When the user switches type in step 2, setValue() replaces the whole
//   object and the discriminant changes.
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Basic Info', 'Log Source', 'Review'];

// Fields that must pass trigger() before advancing from each step.
// Keyed by step index. Last step has no fields — it submits directly.
const STEP_FIELDS: Record<number, (keyof ProjectFormInput)[]> = {
  0: ['name', 'description'],
  1: ['logSourceConfig'],
};

export function NewProjectWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = STEP_LABELS.length;

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    mode: 'onBlur', // validate on blur for a less aggressive UX than onChange
    defaultValues: {
      name: '',
      description: '',
      logSourceConfig: {
        type: 'Application',
        endpoint: '',
      },
    },
  });

  const { createProject, isPending } = useCreateProject();

  // Called by FormStepper's Next/Submit button.
  // Returns true if we successfully advanced (or submitted).
  const handleNext = async (): Promise<boolean> => {
    const isLastStep = currentStep === totalSteps - 1;

    if (isLastStep) {
      // Final step: run full form validation and submit.
      // handleSubmit takes a success callback — on valid data it calls onSubmit.
      // We wrap in a Promise so handleNext can still return boolean.
      let submitted = false;
      await form.handleSubmit((data) => {
        createProject(data);
        submitted = true;
      })();
      return submitted;
    }

    // Intermediate step: validate only this step's fields before advancing.
    const fields = STEP_FIELDS[currentStep];
    const valid = await form.trigger(fields as Parameters<typeof form.trigger>[0]);
    if (valid) {
      setCurrentStep((s) => s + 1);
    }
    return valid;
  };

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleCancel = () => {
    router.back();
  };

  const stepperValue = {
    currentStep,
    totalSteps,
    stepLabels: STEP_LABELS,
    isFirst: currentStep === 0,
    isLast: currentStep === totalSteps - 1,
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <FormStepperProvider value={stepperValue}>
        <FormStepper
          onNext={handleNext}
          onPrev={handlePrev}
          onCancel={handleCancel}
          submitLabel="Create Project"
          isSubmitting={isPending}
        >
          {currentStep === 0 && <ProjectBasicInfoStep form={form} />}
          {currentStep === 1 && <ProjectLogSourceStep form={form} />}
          {currentStep === 2 && <ProjectReviewStep form={form} />}
        </FormStepper>
      </FormStepperProvider>
    </div>
  );
}
