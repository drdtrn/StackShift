'use client';

import { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// FormStepperContext
//
// Carries read-only step state to any child that needs it. Consumers (step
// components, review summaries) can ask "what step am I on?" or "how many
// steps total?" without receiving props through every layer.
//
// WHY React Context here instead of Zustand?
//   Zustand is for global persistent state (auth session, theme, active
//   project). This stepper state only exists while a wizard is mounted — it
//   has no meaning outside the form. Context is the idiomatic tool for
//   component-tree-local shared state.
//
// WHY is this read-only?
//   Navigation functions (goNext / goPrev) live in the wizard component
//   because the wizard owns the validation logic: "before advancing to step 2,
//   trigger RHF validation on the step-1 fields". Mixing that logic into
//   context would couple the generic context to RHF, making it impossible to
//   reuse for a different form library.
//
// USAGE:
//   Wrap the wizard with <FormStepperProvider value={...}>
//   Consume via useFormStepper() in any child.
// ---------------------------------------------------------------------------

export interface FormStepperContextValue {
  /** Zero-indexed current step number. */
  currentStep: number;
  /** Total number of steps in this wizard. */
  totalSteps: number;
  /** Human-readable labels for each step (used by the visual indicator). */
  stepLabels: string[];
  /** True when currentStep === 0 */
  isFirst: boolean;
  /** True when currentStep === totalSteps - 1 */
  isLast: boolean;
}

const FormStepperContext = createContext<FormStepperContextValue | null>(null);

export function FormStepperProvider({
  value,
  children,
}: {
  value: FormStepperContextValue;
  children: React.ReactNode;
}) {
  return (
    <FormStepperContext.Provider value={value}>
      {children}
    </FormStepperContext.Provider>
  );
}

/**
 * Returns the stepper context. Throws if used outside a FormStepperProvider.
 *
 * Throwing in this case is intentional: a missing provider is always a
 * programming error, not a runtime condition. The error surfaces immediately
 * in development rather than causing a silent undefined reference.
 */
export function useFormStepper(): FormStepperContextValue {
  const ctx = useContext(FormStepperContext);
  if (!ctx) {
    throw new Error('useFormStepper must be used inside <FormStepperProvider>');
  }
  return ctx;
}
