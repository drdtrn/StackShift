import { useNotificationStore } from '../useNotificationStore';

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.getState().reset();
  });

  it('starts at 0', () => {
    expect(useNotificationStore.getState().unread).toBe(0);
  });

  it('increments by 1', () => {
    useNotificationStore.getState().increment();
    expect(useNotificationStore.getState().unread).toBe(1);
  });

  it('increments cumulatively', () => {
    useNotificationStore.getState().increment();
    useNotificationStore.getState().increment();
    useNotificationStore.getState().increment();
    expect(useNotificationStore.getState().unread).toBe(3);
  });

  it('reset() returns to 0', () => {
    useNotificationStore.getState().increment();
    useNotificationStore.getState().increment();
    useNotificationStore.getState().reset();
    expect(useNotificationStore.getState().unread).toBe(0);
  });
});
