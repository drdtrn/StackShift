/**
 * Tests for FormStepper
 *
 * FormStepper:
 *   - Renders the correct number of step labels
 *   - Marks the active step with aria-current="step"
 *   - Shows checkmarks for completed steps (index < currentStep)
 *   - Hides the Back button on the first step
 *   - Shows the Back button on subsequent steps
 *   - Shows "Next" on intermediate steps
 *   - Shows a custom submit label on the last step
 *   - Calls onNext when the action button is clicked
 *   - Calls onPrev when the Back button is clicked
 *   - Calls onCancel when the Cancel button is clicked
 *   - Disables all buttons while isSubmitting is true
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FormStepper } from '@/app/components/forms/FormStepper';
import { FormStepperProvider } from '@/app/components/forms/FormStepperContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Basic Info', 'Configure', 'Review'];

function renderStepper({
  currentStep = 0,
  onNext = jest.fn().mockResolvedValue(true),
  onPrev = jest.fn(),
  onCancel = jest.fn(),
  submitLabel = 'Submit',
  isSubmitting = false,
}: {
  currentStep?: number;
  onNext?: () => Promise<boolean>;
  onPrev?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
} = {}) {
  const stepperValue = {
    currentStep,
    totalSteps: STEP_LABELS.length,
    stepLabels: STEP_LABELS,
    isFirst: currentStep === 0,
    isLast: currentStep === STEP_LABELS.length - 1,
  };

  return render(
    <FormStepperProvider value={stepperValue}>
      <FormStepper
        onNext={onNext}
        onPrev={onPrev}
        onCancel={onCancel}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
      >
        <div>Step {currentStep + 1} content</div>
      </FormStepper>
    </FormStepperProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FormStepper — step indicator', () => {
  it('renders all step labels', () => {
    renderStepper();
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('marks the active step with aria-current="step"', () => {
    renderStepper({ currentStep: 1 });
    // The active circle element carries aria-current
    const activeCircle = document.querySelector('[aria-current="step"]');
    expect(activeCircle).not.toBeNull();
  });

  it('renders step numbers for upcoming steps', () => {
    renderStepper({ currentStep: 0 });
    // Steps 2 and 3 should show "2" and "3"
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders a checkmark (no number) for completed steps', () => {
    renderStepper({ currentStep: 2 });
    // With step 2 (index 2) active, steps 0 and 1 are completed — they show
    // a checkmark SVG instead of a number. Only "3" should be visible as a
    // text node (the active step still shows its number; only COMPLETED steps
    // swap the number for a checkmark).
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    // The active step (index 2) still renders its label as "3"
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('FormStepper — navigation buttons', () => {
  it('hides the Back button on the first step', () => {
    renderStepper({ currentStep: 0 });
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('shows the Back button on intermediate steps', () => {
    renderStepper({ currentStep: 1 });
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('shows the Back button on the last step', () => {
    renderStepper({ currentStep: 2 });
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('shows "Next" on non-last steps', () => {
    renderStepper({ currentStep: 0 });
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('shows the custom submitLabel on the last step', () => {
    renderStepper({ currentStep: 2, submitLabel: 'Create Project' });
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });

  it('shows the Cancel button', () => {
    renderStepper();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});

describe('FormStepper — callbacks', () => {
  it('calls onNext when the Next button is clicked', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    renderStepper({ onNext });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it('calls onPrev when the Back button is clicked', () => {
    const onPrev = jest.fn();
    renderStepper({ currentStep: 1, onPrev });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    const onCancel = jest.fn();
    renderStepper({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('FormStepper — submitting state', () => {
  it('disables the action button while isSubmitting', () => {
    renderStepper({ currentStep: 2, submitLabel: 'Submit', isSubmitting: true });
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('disables the Cancel button while isSubmitting', () => {
    renderStepper({ isSubmitting: true });
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('disables the Back button while isSubmitting', () => {
    renderStepper({ currentStep: 1, isSubmitting: true });
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });
});

describe('FormStepper — children', () => {
  it('renders children (active step content)', () => {
    renderStepper({ currentStep: 1 });
    expect(screen.getByText('Step 2 content')).toBeInTheDocument();
  });
});
