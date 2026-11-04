import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppStatus from './AppStatus';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  updateServiceWorker: vi.fn(async () => {}),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

describe('AppStatus', () => {
  beforeEach(() => {
    sw.needRefresh = false;
    sw.updateServiceWorker.mockClear();
    setOnline(true);
  });
  afterEach(() => setOnline(true));

  it('says nothing while online and up to date', () => {
    const { container } = render(<AppStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tells you when the network drops, and clears when it returns', () => {
    render(<AppStatus />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });

  it('offers a new version and reloads into it only on request', async () => {
    sw.needRefresh = true;
    render(<AppStatus />);
    expect(screen.getByText(/new version of mousetail/i)).toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
