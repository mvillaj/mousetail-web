import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing';

let reduceMotion = false;
let reveal: (() => void) | null = null;

beforeEach(() => {
  reduceMotion = false;
  reveal = null;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduceMotion && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  // The pull waits to be seen; tests decide when it scrolls into view.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe() {
        reveal = () =>
          this.cb(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

describe('Landing', () => {
  it('opens on the photo, the headline and one press', () => {
    const { container } = renderLanding();
    const splash = container.querySelector<HTMLElement>('.splash')!;

    const photo = within(splash).getByRole('img', { name: /espresso running/i });
    expect(photo).toHaveAttribute('srcset', expect.stringContaining('2000w'));
    // WebP first, with the JPEG srcset above as the fallback.
    const webp = photo.closest('picture')!.querySelector('source[type="image/webp"]');
    expect(webp).toHaveAttribute('srcset', expect.stringContaining('.webp 2000w'));
    expect(within(splash).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Bitter? Sour? Chase the mouse tail.',
    );
    // The splash says what the app is for, and names the machine.
    expect(splash).toHaveTextContent(/profile studio for the Fellow Espresso Series\s1/);
    // The headline and its press belong to the main landmark, not before it.
    expect(splash.closest('main')).not.toBeNull();
    // The one press shows the pull; the account ask waits until the coach has earned it.
    const press = splash.querySelectorAll<HTMLElement>('.btn-primary');
    expect(press).toHaveLength(1);
    expect(press[0]).toHaveAccessibleName(/watch a shot pull/i);
    expect(press[0]).toHaveAttribute('href', '#pull');
    expect(within(splash).queryByRole('link', { name: 'Create account' })).toBeNull();
    expect(screen.getByRole('link', { name: /coach my own shots/i })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('ends on the poured glass and the ways in', () => {
    const { container } = renderLanding();
    const close = container.querySelector<HTMLElement>('.close')!;
    expect(within(close).getByText('End of shot')).toBeInTheDocument();
    expect(within(close).getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(screen.queryByRole('heading', { name: /who it/i })).toBeNull();
  });

  it('holds the pull until it scrolls into view', () => {
    vi.useFakeTimers();
    renderLanding();
    const again = screen.getByRole('button', { name: /pull it again/i });

    act(() => vi.advanceTimersByTime(10_000));
    expect(again).toBeDisabled();

    act(() => reveal!());
    act(() => vi.advanceTimersByTime(10_000));
    expect(again).toBeEnabled();
    expect(screen.getByText(/g out, balanced/)).toBeInTheDocument();
  });

  it('shows the finished pull at once under reduced motion', () => {
    reduceMotion = true;
    renderLanding();
    expect(screen.getByRole('button', { name: /pull it again/i })).toBeEnabled();
  });
});
