'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { projectFormSchema, type ProjectFormInput } from '@/app/lib/schemas/project';
import { FormStepperProvider } from '@/app/components/forms/FormStepperContext';
import { FormStepper } from '@/app/components/forms/FormStepper';
import { ProjectBasicInfoStep } from './ProjectBasicInfoStep';
import { ProjectReviewStep } from './ProjectReviewStep';
import { useCreateProject } from '@/app/hooks/mutations/use-create-project';

// ---------------------------------------------------------------------------
// NewProjectWizard — 2-step form orchestrator
//
// Step 0: Basic info (name, description)
// Step 1: Review (read-only)
//
// Log-source configuration was removed: only HTTP ingestion is supported and
// API keys are issued per LogSource via a separate flow (Plan 02).
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Basic Info', 'Review'];

const STEP_FIELDS: Record<number, (keyof ProjectFormInput)[]> = {
  0: ['name', 'description'],
};

export function NewProjectWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = STEP_LABELS.length;

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const { createProject, isPending } = useCreateProject();

  const handleNext = async (): Promise<boolean> => {
    const isLastStep = currentStep === totalSteps - 1;

    if (isLastStep) {
      let submitted = false;
      await form.handleSubmit((data) => {
        createProject(data);
        submitted = true;
      })();
      return submitted;
    }

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
          {currentStep === 1 && <ProjectReviewStep form={form} />}
        </FormStepper>
      </FormStepperProvider>
    </div>
  );
}
