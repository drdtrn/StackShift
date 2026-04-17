'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { alertRuleFormSchema, type AlertRuleFormInput } from '@/app/lib/schemas/alert-rule';
import { FormStepperProvider } from '@/app/components/forms/FormStepperContext';
import { FormStepper } from '@/app/components/forms/FormStepper';
import { AlertBasicInfoStep } from './AlertBasicInfoStep';
import { AlertConditionStep } from './AlertConditionStep';
import { AlertReviewStep } from './AlertReviewStep';
import { useCreateAlertRule } from '@/app/hooks/mutations/use-create-alert-rule';

// ---------------------------------------------------------------------------
// AlertRuleBuilder — 3-step form orchestrator
//
// Step field map for trigger():
//   Step 0: ['name', 'projectId']
//   Step 1: ['condition']   ← validates the full discriminated union object
//   Step 2: (submit)
//
// Default values:
//   condition.type defaults to 'ErrorRate'. When the user switches types,
//   AlertConditionStep calls setValue('condition', CONDITION_DEFAULTS[type])
//   which replaces the whole object and changes the discriminant.
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Basic Info', 'Condition', 'Review'];

const STEP_FIELDS: Record<number, (keyof AlertRuleFormInput)[]> = {
  0: ['name', 'projectId'],
  1: ['condition'],
};

export function AlertRuleBuilder() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = STEP_LABELS.length;

  const form = useForm<AlertRuleFormInput>({
    resolver: zodResolver(alertRuleFormSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      projectId: '',
      condition: {
        type: 'ErrorRate',
        threshold: 5,
        windowMinutes: 15,
      },
    },
  });

  const { createAlertRule, isPending } = useCreateAlertRule();

  const handleNext = async (): Promise<boolean> => {
    const isLastStep = currentStep === totalSteps - 1;

    if (isLastStep) {
      let submitted = false;
      await form.handleSubmit((data) => {
        createAlertRule(data);
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

  const handlePrev = () => setCurrentStep((s) => Math.max(0, s - 1));
  const handleCancel = () => router.back();

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
          submitLabel="Create Rule"
          isSubmitting={isPending}
        >
          {currentStep === 0 && <AlertBasicInfoStep form={form} />}
          {currentStep === 1 && <AlertConditionStep form={form} />}
          {currentStep === 2 && <AlertReviewStep form={form} />}
        </FormStepper>
      </FormStepperProvider>
    </div>
  );
}
