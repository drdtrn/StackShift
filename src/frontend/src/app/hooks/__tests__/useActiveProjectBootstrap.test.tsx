import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Project } from '@/app/types';
import { useUIStore } from '../useUIStore';
import { useActiveProjectBootstrap } from '../useActiveProjectBootstrap';

jest.mock('../queries/use-projects', () => ({
  useProjects: jest.fn(),
}));

import { useProjects } from '../queries/use-projects';

const useProjectsMock = useProjects as jest.MockedFunction<typeof useProjects>;

function makeProject(id: string): Project {
  return {
    id,
    organizationId: 'org-1',
    name: `Project ${id}`,
    slug: `project-${id}`,
    description: null,
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logSourceCount: 0,
    activeIncidentCount: 0,
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  useUIStore.setState({ activeProjectId: null });
  useProjectsMock.mockReset();
});

describe('useActiveProjectBootstrap', () => {
  it('sets activeProjectId to the first project when none is set', async () => {
    useProjectsMock.mockReturnValue({
      data: [makeProject('p-1'), makeProject('p-2')],
      isLoading: false,
    } as ReturnType<typeof useProjects>);

    renderHook(() => useActiveProjectBootstrap(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(useUIStore.getState().activeProjectId).toBe('p-1');
    });
  });

  it('does not overwrite an existing activeProjectId', () => {
    useUIStore.setState({ activeProjectId: 'p-existing' });
    useProjectsMock.mockReturnValue({
      data: [makeProject('p-1')],
      isLoading: false,
    } as ReturnType<typeof useProjects>);

    renderHook(() => useActiveProjectBootstrap(), { wrapper: makeWrapper() });

    expect(useUIStore.getState().activeProjectId).toBe('p-existing');
  });

  it('is a no-op when the projects list is empty', () => {
    const empty: Project[] = [];
    useProjectsMock.mockReturnValue({
      data: empty,
      isLoading: false,
    } as ReturnType<typeof useProjects>);

    renderHook(() => useActiveProjectBootstrap(), { wrapper: makeWrapper() });

    expect(useUIStore.getState().activeProjectId).toBeNull();
  });

  it('is a no-op while projects are still loading', () => {
    useProjectsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useProjects>);

    renderHook(() => useActiveProjectBootstrap(), { wrapper: makeWrapper() });

    expect(useUIStore.getState().activeProjectId).toBeNull();
  });
});
