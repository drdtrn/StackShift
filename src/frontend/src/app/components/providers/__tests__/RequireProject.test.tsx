import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequireProject } from '@/app/components/providers/RequireProject';
import type { Project } from '@/app/types';

const mockPush = jest.fn();
const mockUseProjects = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: () => mockUseProjects(),
}));

function makeProject(): Project {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: '00000000-0000-0000-0000-000000000001',
    name: 'API Gateway',
    slug: 'api-gateway',
    description: null,
    color: '#3b82f6',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    logSourceCount: 0,
    activeIncidentCount: 0,
  };
}

beforeEach(() => {
  mockPush.mockReset();
  mockUseProjects.mockReset();
});

describe('RequireProject', () => {
  it('renders a loading state while projects load', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(
      <RequireProject>
        <div>Project content</div>
      </RequireProject>,
    );

    expect(screen.queryByText('Project content')).not.toBeInTheDocument();
  });

  it('renders an error state when projects fail to load', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(
      <RequireProject>
        <div>Project content</div>
      </RequireProject>,
    );

    expect(screen.getByText(/could not load projects/i)).toBeInTheDocument();
    expect(screen.queryByText('Project content')).not.toBeInTheDocument();
  });

  it('blocks children when no projects exist', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(
      <RequireProject>
        <div>Project content</div>
      </RequireProject>,
    );

    expect(screen.getByText('Create a project first')).toBeInTheDocument();
    expect(screen.queryByText('Project content')).not.toBeInTheDocument();
  });

  it('links the empty state to the projects page', () => {
    mockUseProjects.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(
      <RequireProject>
        <div>Project content</div>
      </RequireProject>,
    );

    fireEvent.click(screen.getByRole('button', { name: /go to projects/i }));

    expect(mockPush).toHaveBeenCalledWith('/projects');
  });

  it('renders children when projects exist', () => {
    mockUseProjects.mockReturnValue({ data: [makeProject()], isLoading: false, isError: false });

    render(
      <RequireProject>
        <div>Project content</div>
      </RequireProject>,
    );

    expect(screen.getByText('Project content')).toBeInTheDocument();
  });
});
