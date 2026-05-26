import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertRulesView } from '@/app/(dashboard)/alerts/_components/AlertRulesView';
import type { AlertRule, Project } from '@/app/types';
import { useUIStore } from '@/app/hooks/useUIStore';

const mockUseAlertRules = jest.fn();
const mockUseProjects = jest.fn();
const mockUpdateMutate = jest.fn();
const mockDeleteMutate = jest.fn();

jest.mock('@/app/hooks/queries/use-alert-rules', () => ({
  useAlertRules: (projectId: string | null | undefined) => mockUseAlertRules(projectId),
}));

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: () => mockUseProjects(),
}));

jest.mock('@/app/hooks/mutations/use-create-alert-rule', () => ({
  useUpdateAlertRule: () => ({ mutate: mockUpdateMutate }),
  useDeleteAlertRule: () => ({ mutate: mockDeleteMutate }),
}));

const PROJECT: Project = {
  id: '22222222-2222-2222-2222-222222222222',
  organizationId: '33333333-3333-3333-3333-333333333333',
  name: 'API Gateway',
  slug: 'api-gateway',
  description: null,
  color: '#3b82f6',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  logSourceCount: 0,
  activeIncidentCount: 0,
};

const RULE: AlertRule = {
  id: '11111111-1111-1111-1111-111111111111',
  projectId: PROJECT.id,
  organizationId: PROJECT.organizationId,
  name: 'High Error Rate',
  condition: 'threshold',
  threshold: 5,
  windowMinutes: 15,
  logLevel: null,
  pattern: null,
  isActive: true,
  severity: 'medium',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  useUIStore.setState({ activeProjectId: PROJECT.id });
  mockUseAlertRules.mockReset();
  mockUseProjects.mockReset();
  mockUseProjects.mockReturnValue({ data: [PROJECT] });
  mockUpdateMutate.mockReset();
  mockDeleteMutate.mockReset();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  jest.spyOn(window, 'prompt').mockReturnValue('Renamed Rule');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AlertRulesView', () => {
  it('renders alert rules for the active project', () => {
    mockUseAlertRules.mockReturnValue({ data: [RULE], isLoading: false, isError: false });

    render(<AlertRulesView />);

    expect(mockUseAlertRules).toHaveBeenCalledWith(PROJECT.id);
    expect(screen.getByText('High Error Rate')).toBeInTheDocument();
    expect(screen.getByText('threshold')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('renders an empty state for a project with no rules', () => {
    mockUseAlertRules.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<AlertRulesView />);

    expect(screen.getByText('No alert rules')).toBeInTheDocument();
  });

  it('updates a rule when pause is clicked', () => {
    mockUseAlertRules.mockReturnValue({ data: [RULE], isLoading: false, isError: false });

    render(<AlertRulesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: RULE.id, isActive: false }),
    );
  });

  it('renames a rule when edit is clicked', () => {
    mockUseAlertRules.mockReturnValue({ data: [RULE], isLoading: false, isError: false });

    render(<AlertRulesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: RULE.id, name: 'Renamed Rule' }),
    );
  });

  it('deletes a rule after confirmation', () => {
    mockUseAlertRules.mockReturnValue({ data: [RULE], isLoading: false, isError: false });

    render(<AlertRulesView />);
    fireEvent.click(screen.getByRole('button', { name: /delete high error rate/i }));

    expect(mockDeleteMutate).toHaveBeenCalledWith({ id: RULE.id, name: RULE.name });
  });
});
