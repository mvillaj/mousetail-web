import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_AFTER_MS, OPEN_AFTER_MS, useHoverIntent } from './useHoverIntent';

function Panel() {
  const { open, props } = useHoverIntent();
  return (
    <>
      <div data-testid="panel" data-open={open || undefined} {...props}>
        <button>Inside</button>
      </div>
      <button>Outside</button>
    </>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const panel = () => screen.getByTestId('panel');
const isOpen = () => panel().hasAttribute('data-open');
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useHoverIntent', () => {
  it('opens once the pointer has rested a moment, not on the way past', () => {
    render(<Panel />);
    fireEvent.pointerEnter(panel(), { pointerType: 'mouse' });
    wait(OPEN_AFTER_MS - 50);
    expect(isOpen()).toBe(false);
    wait(50);
    expect(isOpen()).toBe(true);
  });

  it('passing straight over never opens it', () => {
    render(<Panel />);
    fireEvent.pointerEnter(panel(), { pointerType: 'mouse' });
    wait(OPEN_AFTER_MS / 2);
    fireEvent.pointerLeave(panel(), { pointerType: 'mouse' });
    wait(OPEN_AFTER_MS * 2);
    expect(isOpen()).toBe(false);
  });

  it('closes a moment after the pointer leaves, unless it comes back', () => {
    render(<Panel />);
    fireEvent.pointerEnter(panel(), { pointerType: 'mouse' });
    wait(OPEN_AFTER_MS);
    fireEvent.pointerLeave(panel(), { pointerType: 'mouse' });
    wait(CLOSE_AFTER_MS / 2);
    expect(isOpen()).toBe(true);
    // A slight overshoot and back: still open.
    fireEvent.pointerEnter(panel(), { pointerType: 'mouse' });
    wait(CLOSE_AFTER_MS * 2);
    expect(isOpen()).toBe(true);

    fireEvent.pointerLeave(panel(), { pointerType: 'mouse' });
    wait(CLOSE_AFTER_MS);
    expect(isOpen()).toBe(false);
  });

  it('ignores touch, which has no pointer to leave and close it', () => {
    render(<Panel />);
    fireEvent.pointerEnter(panel(), { pointerType: 'touch' });
    wait(OPEN_AFTER_MS * 2);
    expect(isOpen()).toBe(false);
  });

  it('opens at once for keyboard focus, and stays open until focus leaves', () => {
    render(<Panel />);
    fireEvent.keyDown(window, { key: 'Tab' });
    act(() => screen.getByRole('button', { name: 'Inside' }).focus());
    expect(isOpen()).toBe(true);

    // The pointer wandering off doesn't close it while you're tabbing in it.
    fireEvent.pointerEnter(panel(), { pointerType: 'mouse' });
    fireEvent.pointerLeave(panel(), { pointerType: 'mouse' });
    wait(CLOSE_AFTER_MS * 2);
    expect(isOpen()).toBe(true);

    act(() => screen.getByRole('button', { name: 'Outside' }).focus());
    expect(isOpen()).toBe(false);
  });

  it('stays shut for focus from a click', () => {
    render(<Panel />);
    fireEvent.pointerDown(window);
    act(() => screen.getByRole('button', { name: 'Inside' }).focus());
    expect(isOpen()).toBe(false);
  });
});
